import os
import uuid
import shutil
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, Optional, List, Tuple
from flask import current_app
from sqlalchemy import select
from app.extensions import db
from app.common.database.transactions import atomic
from app.common.errors.exceptions import ValidationError, NotFoundError, ForbiddenError
from app.modules.auth.models import AuditLog, User
from app.modules.candidates.models import CandidateApplication, APPLICATION_STATUS_APPROVED
from app.modules.letters.models import (
    DocumentTemplate,
    CandidateLetter,
    TEMPLATE_TYPE_LOI,
    TEMPLATE_TYPE_OFFER,
    VALID_TEMPLATE_TYPES,
    LETTER_STATUS_DRAFT,
    LETTER_STATUS_FINAL,
    LETTER_STATUS_SENT,
    LETTER_STATUS_FAILED,
    DEFAULT_LOI_MAPPINGS,
    DEFAULT_OFFER_MAPPINGS,
    utc_now,
)
import docx

try:
    from reportlab.lib.pagesizes import letter as LETTER_PAGESIZE
    from reportlab.pdfgen import canvas
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


def replace_in_runs(paragraph, search_text: str, replacement_text: str) -> bool:
    """Safely replace text across runs in a paragraph while preserving font, size, bold, and styles."""
    if not search_text or search_text == replacement_text:
        return False

    replaced_any = False
    start_pos = 0

    while True:
        full_text = "".join(r.text for r in paragraph.runs)
        idx = full_text.find(search_text, start_pos)
        if idx == -1:
            break

        start_char = idx
        end_char = idx + len(search_text)

        cur = 0
        start_run = None
        start_offset = 0
        end_run = None
        end_offset = 0

        for i, r in enumerate(paragraph.runs):
            rlen = len(r.text)
            r_start = cur
            r_end = cur + rlen
            if start_run is None and r_start <= start_char < r_end:
                start_run = i
                start_offset = start_char - r_start
            if r_start < end_char <= r_end:
                end_run = i
                end_offset = end_char - r_start
                break
            cur = r_end

        if start_run is not None and end_run is not None:
            if start_run == end_run:
                r = paragraph.runs[start_run]
                r.text = r.text[:start_offset] + replacement_text + r.text[end_offset:]
            else:
                paragraph.runs[start_run].text = paragraph.runs[start_run].text[:start_offset] + replacement_text
                paragraph.runs[end_run].text = paragraph.runs[end_run].text[end_offset:]
                for mid in range(start_run + 1, end_run):
                    paragraph.runs[mid].text = ""
            replaced_any = True
            start_pos = start_char + len(replacement_text)
        else:
            break

    return replaced_any


def replace_in_cell(cell, search_text: str, replacement_text: str) -> bool:
    """Replace text in a table cell without clearing cell styling."""
    replaced = False
    for p in cell.paragraphs:
        if replace_in_runs(p, search_text, replacement_text):
            replaced = True
    return replaced


def update_cell_value_preserving_style(cell, new_value: str) -> None:
    """Set cell text while strictly preserving existing run formatting and XML properties."""
    new_str = str(new_value).strip()
    if not cell.paragraphs:
        cell.text = new_str
        return

    target_r_elem = None
    for p in cell.paragraphs:
        for r in p.runs:
            if r.text.strip():
                target_r_elem = r._r
                r.text = new_str
                break
        if target_r_elem is not None:
            break

    if target_r_elem is not None:
        for p in cell.paragraphs:
            for r in p.runs:
                if r._r is not target_r_elem:
                    r.text = ""
    else:
        if cell.paragraphs[0].runs:
            cell.paragraphs[0].runs[0].text = new_str
        else:
            cell.paragraphs[0].text = new_str


# Backward compatibility alias
set_cell_text_preserve_style = update_cell_value_preserving_style


def convert_docx_to_pdf_native(docx_path: str, pdf_path: str) -> bool:
    """Convert a DOCX file to PDF preserving native fonts, tables, margins, and page breaks."""
    abs_docx = os.path.abspath(docx_path)
    abs_pdf = os.path.abspath(pdf_path)

    # 1. Primary: Windows Word COM automation
    try:
        import win32com.client
        import pythoncom

        pythoncom.CoInitialize()
        word = None
        doc = None
        try:
            word = win32com.client.DispatchEx("Word.Application")
            word.Visible = False
            word.DisplayAlerts = False
            doc = word.Documents.Open(abs_docx, ReadOnly=True)
            doc.ExportAsFixedFormat(abs_pdf, 17)  # 17 = wdExportFormatPDF
        finally:
            if doc:
                try:
                    doc.Close(False)
                except Exception:
                    pass
            if word:
                try:
                    word.Quit()
                except Exception:
                    pass
            pythoncom.CoUninitialize()

        if os.path.exists(abs_pdf) and os.path.getsize(abs_pdf) > 0:
            return True
    except Exception as e:
        current_app.logger.warning(f"Word COM PDF export attempt failed: {e}")

    # 2. Secondary: docx2pdf
    try:
        import docx2pdf

        docx2pdf.convert(abs_docx, abs_pdf)
        if os.path.exists(abs_pdf) and os.path.getsize(abs_pdf) > 0:
            return True
    except Exception as e:
        current_app.logger.warning(f"docx2pdf conversion failed: {e}")

    # 3. Fallback: ReportLab
    if REPORTLAB_AVAILABLE:
        try:
            c = canvas.Canvas(abs_pdf, pagesize=LETTER_PAGESIZE)
            d = docx.Document(abs_docx)
            y = 750
            c.setFont("Helvetica-Bold", 12)
            c.drawString(50, y, "Official Candidate Document")
            y -= 25
            c.setFont("Helvetica", 9)
            for p in d.paragraphs:
                txt = p.text.strip()
                if txt:
                    for line in txt.split("\n"):
                        words = line.split()
                        cur_line = ""
                        for w in words:
                            if len(cur_line) + len(w) > 85:
                                c.drawString(50, y, cur_line)
                                y -= 13
                                cur_line = w + " "
                                if y < 45:
                                    c.showPage()
                                    y = 750
                                    c.setFont("Helvetica", 9)
                            else:
                                cur_line += w + " "
                        if cur_line:
                            c.drawString(50, y, cur_line)
                            y -= 13
                            if y < 45:
                                c.showPage()
                                y = 750
                                c.setFont("Helvetica", 9)
                    y -= 6
                    if y < 45:
                        c.showPage()
                        y = 750
                        c.setFont("Helvetica", 9)
            c.save()
            if os.path.exists(abs_pdf) and os.path.getsize(abs_pdf) > 0:
                return True
        except Exception as e:
            current_app.logger.error(f"ReportLab fallback PDF failed: {e}")

    return False


def get_templates_storage_dir() -> str:
    path = os.path.join(current_app.root_path, "..", "storage", "templates")
    os.makedirs(path, exist_ok=True)
    return os.path.abspath(path)


def get_generated_letters_storage_dir(app_id: str) -> str:
    path = os.path.join(current_app.root_path, "..", "storage", "generated_letters", str(app_id))
    os.makedirs(path, exist_ok=True)
    return os.path.abspath(path)


def get_sent_emails_storage_dir() -> str:
    path = os.path.join(current_app.root_path, "..", "storage", "sent_emails")
    os.makedirs(path, exist_ok=True)
    return os.path.abspath(path)


class EmailService:
    """Enterprise email delivery service with real SMTP support and isolated offline fallback."""

    @staticmethod
    def send_email(
        to_email: str,
        subject: str,
        html_body: str,
        text_body: str,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Send an email with attachments via SMTP or save to local storage in test/dev mode."""
        if not to_email or "@" not in to_email:
            raise ValidationError(f"Invalid recipient email address: '{to_email}'")

        smtp_host = os.getenv("SMTP_HOST", "").strip()
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USERNAME", "").strip()
        smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
        smtp_use_tls = os.getenv("SMTP_USE_TLS", "True").lower() in ("true", "1")
        sender_email = os.getenv("SMTP_SENDER_EMAIL", "hr@fiberforce.in").strip()
        sender_name = os.getenv("SMTP_SENDER_NAME", "Fiber Force Private Limited").strip()

        from_header = f"{sender_name} <{sender_email}>"

        msg = MIMEMultipart("mixed")
        msg["From"] = from_header
        msg["To"] = to_email
        msg["Subject"] = subject
        msg["Date"] = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")

        # Body parts
        alt_part = MIMEMultipart("alternative")
        alt_part.attach(MIMEText(text_body, "plain", "utf-8"))
        alt_part.attach(MIMEText(html_body, "html", "utf-8"))
        msg.attach(alt_part)

        # Attachments
        if attachments:
            for att in attachments:
                fname = att.get("filename", "document.pdf")
                data = att.get("content")
                if data is None and "filepath" in att:
                    with open(att["filepath"], "rb") as f:
                        data = f.read()
                if data:
                    part = MIMEApplication(data, Name=fname)
                    part["Content-Disposition"] = f'attachment; filename="{fname}"'
                    msg.attach(part)

        # Emulated dispatch mode if SMTP_HOST is not configured or set to mock/console/testing
        if not smtp_host or smtp_host.lower() in ("console", "mock", "none") or current_app.config.get("TESTING"):
            sent_dir = get_sent_emails_storage_dir()
            msg_id = f"mock-msg-{uuid.uuid4().hex[:12]}"
            log_path = os.path.join(sent_dir, f"{msg_id}.eml")
            with open(log_path, "wb") as f:
                f.write(msg.as_bytes())

            current_app.logger.info(
                f"[EmailService:EMULATED] Dispatched email to {to_email} (Subject: '{subject}') -> Saved to {log_path}"
            )
            return {
                "success": True,
                "mode": "emulated",
                "message_id": msg_id,
                "recipient": to_email,
                "log_path": log_path,
            }

        # Live SMTP delivery
        try:
            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
                if smtp_use_tls:
                    server.starttls()

            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)

            server.send_message(msg)
            server.quit()

            msg_id = f"smtp-msg-{uuid.uuid4().hex[:12]}"
            current_app.logger.info(f"[EmailService:SMTP] Dispatched email to {to_email} via {smtp_host}:{smtp_port}")
            return {
                "success": True,
                "mode": "smtp",
                "message_id": msg_id,
                "recipient": to_email,
            }
        except Exception as e:
            current_app.logger.error(f"[EmailService:ERROR] Failed to send email to {to_email}: {str(e)}")
            raise ValidationError(f"Email service delivery failure: {str(e)}")


class LetterTemplateService:
    """Manages master Word templates and their field placeholder mappings."""

    @staticmethod
    def ensure_default_templates() -> None:
        """Seed master LOI and Offer Letter templates if not already present, preserving original files untouched."""
        storage_dir = get_templates_storage_dir()

        # Check Letter of Intent
        loi_tmpl = db.session.execute(
            select(DocumentTemplate)
            .where(DocumentTemplate.template_type == TEMPLATE_TYPE_LOI)
            .where(DocumentTemplate.is_active.is_(True))
        ).scalar_one_or_none()

        if not loi_tmpl:
            loi_path = os.path.join(storage_dir, "letter_of_intent_v1.docx")
            ref_src = r"C:\Users\Mayank Office\Downloads\Letter of Intent.docx"
            if os.path.exists(ref_src):
                # Copy original master file byte-for-byte without altering formatting or runs
                shutil.copy2(ref_src, loi_path)
            elif not os.path.exists(loi_path):
                # Create basic fallback template only if reference file is not present
                doc = docx.Document()
                doc.add_heading("Letter of Intent", 0)
                doc.add_paragraph("Date: {{current_date}}")
                doc.add_paragraph("To,\n{{candidate_full_name}}\nAddress: {{candidate_address}}\nMobile: {{candidate_mobile}}\nEmail: {{candidate_email}}")
                doc.add_paragraph("Dear {{candidate_full_name}},\nWe intend to engage your services as {{approved_role_name}} in {{approved_location}}.")
                doc.add_paragraph("Start Date of Services: {{joining_date}}")
                doc.save(loi_path)

            loi_tmpl = DocumentTemplate(
                template_type=TEMPLATE_TYPE_LOI,
                name="Letter of Intent Master Template",
                filename="letter_of_intent_v1.docx",
                storage_path=loi_path,
                version=1,
                is_active=True,
                field_mappings=DEFAULT_LOI_MAPPINGS,
            )
            db.session.add(loi_tmpl)

        # Check Offer Letter
        offer_tmpl = db.session.execute(
            select(DocumentTemplate)
            .where(DocumentTemplate.template_type == TEMPLATE_TYPE_OFFER)
            .where(DocumentTemplate.is_active.is_(True))
        ).scalar_one_or_none()

        if not offer_tmpl:
            offer_path = os.path.join(storage_dir, "offer_letter_v1.docx")
            ref_src = r"C:\Users\Mayank Office\Downloads\FFPL.docx"
            if os.path.exists(ref_src):
                # Copy original master file byte-for-byte without altering formatting or runs
                shutil.copy2(ref_src, offer_path)
            elif not os.path.exists(offer_path):
                doc = docx.Document()
                doc.add_heading("Appointment / Offer Letter", 0)
                doc.add_paragraph("Ref: {{reference_number}}    Date: {{current_date}}")
                doc.add_paragraph("To,\nName: {{candidate_full_name}}\nMobile: {{candidate_mobile}}")
                doc.add_paragraph("Dear {{candidate_full_name}},\nYou have been appointed as {{approved_role_name}} in {{approved_location}}.")
                doc.add_paragraph("Joining Date: {{joining_date}}")
                doc.save(offer_path)

            offer_tmpl = DocumentTemplate(
                template_type=TEMPLATE_TYPE_OFFER,
                name="Offer Letter Master Template",
                filename="offer_letter_v1.docx",
                storage_path=offer_path,
                version=1,
                is_active=True,
                field_mappings=DEFAULT_OFFER_MAPPINGS,
            )
            db.session.add(offer_tmpl)

        db.session.commit()

    @staticmethod
    def get_active_template(template_type: str) -> DocumentTemplate:
        if template_type not in VALID_TEMPLATE_TYPES:
            raise ValidationError(f"Invalid template type: '{template_type}'. Expected one of {list(VALID_TEMPLATE_TYPES)}")

        LetterTemplateService.ensure_default_templates()

        tmpl = db.session.execute(
            select(DocumentTemplate)
            .where(DocumentTemplate.template_type == template_type)
            .where(DocumentTemplate.is_active.is_(True))
            .order_by(DocumentTemplate.version.desc())
        ).scalars().first()

        if not tmpl:
            raise NotFoundError(f"No active template found for '{template_type}'.")
        return tmpl

    @staticmethod
    def upload_new_template(
        template_type: str,
        file,
        user: User,
    ) -> DocumentTemplate:
        if template_type not in VALID_TEMPLATE_TYPES:
            raise ValidationError(f"Invalid template type: '{template_type}'")

        if not file or not file.filename:
            raise ValidationError("A valid master .docx file must be uploaded.")

        filename = file.filename
        if not filename.lower().endswith(".docx"):
            raise ValidationError("Master template must be a Microsoft Word (.docx) file.")

        storage_dir = get_templates_storage_dir()

        # Find latest version
        current_active = db.session.execute(
            select(DocumentTemplate)
            .where(DocumentTemplate.template_type == template_type)
            .order_by(DocumentTemplate.version.desc())
        ).scalars().first()

        new_version = (current_active.version + 1) if current_active else 1
        safe_filename = f"{template_type}_v{new_version}_{uuid.uuid4().hex[:8]}.docx"
        target_path = os.path.join(storage_dir, safe_filename)

        # Save uploaded file
        file.save(target_path)

        # Validate that the file is a valid Word document
        try:
            docx.Document(target_path)
        except Exception:
            if os.path.exists(target_path):
                os.remove(target_path)
            raise ValidationError("The uploaded file is corrupted or not a valid Microsoft Word (.docx) document.")

        # Deactivate previous active templates of this type
        with atomic():
            if current_active:
                db.session.execute(
                    select(DocumentTemplate)
                    .where(DocumentTemplate.template_type == template_type)
                    .where(DocumentTemplate.is_active.is_(True))
                )
                prev_templates = db.session.execute(
                    select(DocumentTemplate)
                    .where(DocumentTemplate.template_type == template_type)
                    .where(DocumentTemplate.is_active.is_(True))
                ).scalars().all()
                for pt in prev_templates:
                    pt.is_active = False

            mappings = (
                DEFAULT_LOI_MAPPINGS if template_type == TEMPLATE_TYPE_LOI else DEFAULT_OFFER_MAPPINGS
            )

            new_tmpl = DocumentTemplate(
                template_type=template_type,
                name=f"{'Letter of Intent' if template_type == TEMPLATE_TYPE_LOI else 'Offer Letter'} Master Template v{new_version}",
                filename=filename,
                storage_path=target_path,
                version=new_version,
                is_active=True,
                field_mappings=mappings,
                created_by_id=user.id,
            )
            db.session.add(new_tmpl)

            # Audit log
            audit = AuditLog(
                action="TEMPLATE_UPLOADED",
                user_id=user.id,
                resource="document_templates",
                resource_id=str(new_tmpl.id),
                details={
                    "template_type": template_type,
                    "version": new_version,
                    "filename": filename,
                },
            )
            db.session.add(audit)

        return new_tmpl


class LetterGenerationService:
    """Handles automated candidate data population, draft editing, docx/pdf generation, and email dispatch."""

    @staticmethod
    def calculate_salary_breakdown(monthly_salary: float) -> Dict[str, Any]:
        """Generate structured salary components for Annexure II."""
        monthly_ctc = round(monthly_salary, 2)
        basic_monthly = round(monthly_ctc * 0.60, 2)
        medical_monthly = 45.00
        bonus_monthly = round(basic_monthly * 0.0833, 2)
        gratuity_monthly = round(basic_monthly * 0.0481, 2)

        other_allowance = round(monthly_ctc - basic_monthly - medical_monthly - bonus_monthly - gratuity_monthly, 2)
        if other_allowance < 0:
            other_allowance = 0.00

        gross_monthly = monthly_ctc
        gpa_monthly = 45.00
        deductions_monthly = gpa_monthly
        take_home_monthly = round(gross_monthly - deductions_monthly, 2)
        yearly_ctc = round(monthly_ctc * 12, 2)

        return {
            "monthly_ctc": f"{int(monthly_ctc)}",
            "yearly_ctc": f"{int(yearly_ctc)}",
            "total_ctc_monthly": f"{int(monthly_ctc)}",
            "basic_monthly": f"{int(basic_monthly)}",
            "basic_yearly": f"{int(basic_monthly * 12)}",
            "hra_monthly": "0",
            "hra_yearly": "0",
            "conveyance_monthly": "0",
            "conveyance_yearly": "0",
            "other_allowance_monthly": f"{int(other_allowance)}",
            "other_allowance_yearly": f"{int(other_allowance * 12)}",
            "medical_monthly": f"{int(medical_monthly)}",
            "medical_yearly": f"{int(medical_monthly * 12)}",
            "bonus_monthly": f"{int(bonus_monthly)}",
            "bonus_yearly": f"{int(bonus_monthly * 12)}",
            "gratuity_monthly": f"{int(gratuity_monthly)}",
            "gratuity_yearly": f"{int(gratuity_monthly * 12)}",
            "gross_monthly": f"{int(gross_monthly)}",
            "gross_yearly": f"{int(gross_monthly * 12)}",
            "emp_pf_monthly": "0",
            "emp_pf_yearly": "0",
            "emp_esic_monthly": "0",
            "emp_esic_yearly": "0",
            "gpa_monthly": f"{int(gpa_monthly)}",
            "gpa_yearly": f"{int(gpa_monthly * 12)}",
            "prof_tax_monthly": "0",
            "prof_tax_yearly": "0",
            "income_tax_monthly": "0",
            "income_tax_yearly": "0",
            "deductions_monthly": f"{int(deductions_monthly)}",
            "deductions_yearly": f"{int(deductions_monthly * 12)}",
            "take_home_monthly": f"{int(take_home_monthly)}",
            "take_home_yearly": f"{int(take_home_monthly * 12)}",
            "pli_monthly": "0",
            "pli_yearly": "0",
            "net_take_home_monthly": f"{int(take_home_monthly)}",
            "net_take_home_yearly": f"{int(take_home_monthly * 12)}",
            "empr_pf_monthly": "0",
            "empr_pf_yearly": "0",
            "empr_esic_monthly": "0",
            "empr_esic_yearly": "0",
        }

    @staticmethod
    def get_or_create_candidate_letters(
        application_id: uuid.UUID,
        user: User,
    ) -> Dict[str, Any]:
        """Retrieve existing letters for approved candidate or generate fresh drafts."""
        with atomic():
            app = db.session.execute(
                select(CandidateApplication)
                .where(CandidateApplication.id == application_id)
                .with_for_update()
            ).scalar_one_or_none()

            if not app:
                raise NotFoundError("Candidate application record not found.")

            if app.status != APPLICATION_STATUS_APPROVED:
                raise ValidationError(
                    f"Candidate application '{app.application_number}' has status '{app.status}'. "
                    "Letters can only be generated for APPROVED candidates."
                )

            LetterTemplateService.ensure_default_templates()

            loi_tmpl = LetterTemplateService.get_active_template(TEMPLATE_TYPE_LOI)
            offer_tmpl = LetterTemplateService.get_active_template(TEMPLATE_TYPE_OFFER)

            app_dir = get_generated_letters_storage_dir(str(app.id))

            # Check existing LOI, keeping newest if duplicates exist
            all_loi = db.session.execute(
                select(CandidateLetter)
                .where(CandidateLetter.application_id == app.id)
                .where(CandidateLetter.letter_type == TEMPLATE_TYPE_LOI)
                .order_by(CandidateLetter.version.desc(), CandidateLetter.created_at.desc())
            ).scalars().all()
            loi_letter = all_loi[0] if all_loi else None
            if len(all_loi) > 1:
                for dup in all_loi[1:]:
                    db.session.delete(dup)

            # Check existing Offer Letter, keeping newest if duplicates exist
            all_offer = db.session.execute(
                select(CandidateLetter)
                .where(CandidateLetter.application_id == app.id)
                .where(CandidateLetter.letter_type == TEMPLATE_TYPE_OFFER)
                .order_by(CandidateLetter.version.desc(), CandidateLetter.created_at.desc())
            ).scalars().all()
            offer_letter = all_offer[0] if all_offer else None
            if len(all_offer) > 1:
                for dup in all_offer[1:]:
                    db.session.delete(dup)

            monthly_salary = float(app.negotiated_salary or app.asking_salary or 40000)
            salary_breakdown = LetterGenerationService.calculate_salary_breakdown(monthly_salary)

            # Build candidate address
            addr_parts = [app.current_address_line1]
            if app.current_address_line2:
                addr_parts.append(app.current_address_line2)
            addr_parts.append(f"{app.current_city}, {app.current_state} - {app.current_pincode}")
            candidate_address = ", ".join(p for p in addr_parts if p)

            # Build approved location
            loc_parts = []
            if app.district:
                loc_parts.append(f"District {app.district}")
            if app.current_state:
                loc_parts.append(f"State {app.current_state}")
            approved_location = " ".join(loc_parts) if loc_parts else (app.circle or "India")

            # Reference number
            ref_num = f"FFPL/RAJ/{datetime.now().strftime('%Y-%y')}/{datetime.now().strftime('%m')}/{app.application_number[-5:]}"

            # Default fields extracted from DB
            default_fields = {
                "current_date": datetime.now().strftime("%d/%m/%Y"),
                "date": datetime.now().strftime("%d/%m/%Y"),
                "candidate_full_name": app.full_name,
                "candidate_name": app.full_name,
                "candidate_address": candidate_address,
                "candidate_mobile": app.mobile_number,
                "mobile_number": app.mobile_number,
                "candidate_email": app.email,
                "candidate_aadhaar": app.aadhaar_number or "-",
                "approved_role_name": app.role_applied,
                "role_applied": app.role_applied,
                "approved_location": approved_location,
                "location": approved_location,
                "joining_date": "",  # To be specified by user in review page
                "reference_number": ref_num,
                "monthly_salary": f"{int(monthly_salary)}",
                "performance_incentive": "0",
                "miscellaneous_allowance": "0",
                "total_salary": f"{int(monthly_salary)}",
                **salary_breakdown,
            }

            # Create LOI if not exists
            if not loi_letter:
                loi_docx_path = os.path.join(app_dir, f"loi_{app.application_number}.docx")
                LetterGenerationService._render_docx(loi_tmpl.storage_path, loi_docx_path, default_fields, TEMPLATE_TYPE_LOI)
                loi_letter = CandidateLetter(
                    application_id=app.id,
                    template_id=loi_tmpl.id,
                    letter_type=TEMPLATE_TYPE_LOI,
                    version=1,
                    status=LETTER_STATUS_DRAFT,
                    docx_storage_path=loi_docx_path,
                    field_values=default_fields,
                    last_edited_by_id=user.id,
                    last_edited_at=utc_now(),
                )
                db.session.add(loi_letter)
                db.session.flush()

            # Create Offer Letter if not exists
            if not offer_letter:
                offer_docx_path = os.path.join(app_dir, f"offer_{app.application_number}.docx")
                LetterGenerationService._render_docx(offer_tmpl.storage_path, offer_docx_path, default_fields, TEMPLATE_TYPE_OFFER)
                offer_letter = CandidateLetter(
                    application_id=app.id,
                    template_id=offer_tmpl.id,
                    letter_type=TEMPLATE_TYPE_OFFER,
                    version=1,
                    status=LETTER_STATUS_DRAFT,
                    docx_storage_path=offer_docx_path,
                    field_values=default_fields,
                    last_edited_by_id=user.id,
                    last_edited_at=utc_now(),
                )
                db.session.add(offer_letter)
                db.session.flush()

            # Pre-render PDF if missing
            try:
                if not loi_letter.pdf_storage_path or not os.path.exists(loi_letter.pdf_storage_path):
                    LetterGenerationService.get_or_render_pdf(loi_letter)
            except Exception as e:
                current_app.logger.warning(f"Could not pre-render LOI PDF on creation: {e}")

            try:
                if not offer_letter.pdf_storage_path or not os.path.exists(offer_letter.pdf_storage_path):
                    LetterGenerationService.get_or_render_pdf(offer_letter)
            except Exception as e:
                current_app.logger.warning(f"Could not pre-render Offer Letter PDF on creation: {e}")

            db.session.commit()

        return {
            "application": {
                "id": str(app.id),
                "application_number": app.application_number,
                "full_name": app.full_name,
                "email": app.email,
                "mobile_number": app.mobile_number,
                "role_applied": app.role_applied,
                "status": app.status,
                "district": app.district,
                "circle": app.circle,
                "current_state": app.current_state,
                "negotiated_salary": float(app.negotiated_salary) if app.negotiated_salary else None,
            },
            "letter_of_intent": LetterGenerationService._serialize_letter(loi_letter),
            "offer_letter": LetterGenerationService._serialize_letter(offer_letter),
        }

    @staticmethod
    def _serialize_letter(letter: CandidateLetter) -> Dict[str, Any]:
        page_count = 2 if letter.letter_type == TEMPLATE_TYPE_LOI else 5
        if letter.pdf_storage_path and os.path.exists(letter.pdf_storage_path):
            try:
                import pypdf
                reader = pypdf.PdfReader(letter.pdf_storage_path)
                page_count = len(reader.pages)
            except Exception:
                pass

        return {
            "id": str(letter.id),
            "letter_type": letter.letter_type,
            "version": letter.version,
            "status": letter.status,
            "page_count": page_count,
            "docx_url": f"/api/v1/applications/{letter.application_id}/letters/{letter.letter_type}/download?format=docx",
            "pdf_url": f"/api/v1/applications/{letter.application_id}/letters/{letter.letter_type}/download?format=pdf",
            "inline_pdf_url": f"/api/v1/applications/{letter.application_id}/letters/{letter.letter_type}/download?format=pdf&inline=1",
            "field_values": letter.field_values or {},
            "last_edited_at": letter.last_edited_at.isoformat() if letter.last_edited_at else None,
            "sent_at": letter.sent_at.isoformat() if letter.sent_at else None,
            "email_recipient": letter.email_recipient,
            "email_status": letter.email_status,
            "email_error": letter.email_error,
        }

    @staticmethod
    def _render_docx(template_path: str, output_path: str, field_values: Dict[str, Any], letter_type: Optional[str] = None) -> None:
        """Render Word document by copying master template and populating fields while strictly preserving all run styling."""
        if not os.path.exists(template_path):
            raise NotFoundError(f"Master template file '{template_path}' not found.")

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        # Copy pristine master template to working copy path
        shutil.copy2(template_path, output_path)

        doc = docx.Document(output_path)
        is_loi = (letter_type == TEMPLATE_TYPE_LOI) or ("loi" in os.path.basename(output_path).lower())
        is_offer = (letter_type == TEMPLATE_TYPE_OFFER) or ("offer" in os.path.basename(output_path).lower())

        cand_name = str(field_values.get("candidate_full_name", "")).strip()
        cand_mobile = str(field_values.get("candidate_mobile", "")).strip()
        cand_email = str(field_values.get("candidate_email", "")).strip()
        cand_aadhaar = str(field_values.get("candidate_aadhaar", "")).strip()
        cand_addr = str(field_values.get("candidate_address", "")).strip()
        approved_role = str(field_values.get("approved_role_name", "")).strip()
        approved_loc = str(field_values.get("approved_location", "")).strip()
        joining_date = str(field_values.get("joining_date", "")).strip()
        cur_date = str(field_values.get("current_date", "")).strip()
        ref_num = str(field_values.get("reference_number", "")).strip()
        monthly_sal = str(field_values.get("monthly_salary", "40000")).strip()

        # 1. Substitute any explicit {{placeholder}} variables across all document paragraphs
        for p in doc.paragraphs:
            for k, v in field_values.items():
                if v is not None and not isinstance(v, (dict, list)):
                    s_val = str(v)
                    replace_in_runs(p, f"{{{{{k}}}}}", s_val)
                    replace_in_runs(p, f"{{{{ {k} }}}}", s_val)

        # 2. Substitute any explicit {{placeholder}} variables across all table cells
        for t in doc.tables:
            for row in t.rows:
                for cell in row.cells:
                    for k, v in field_values.items():
                        if v is not None and not isinstance(v, (dict, list)):
                            s_val = str(v)
                            replace_in_cell(cell, f"{{{{{k}}}}}", s_val)
                            replace_in_cell(cell, f"{{{{ {k} }}}}", s_val)

        if is_loi:
            # 1. Letter of Intent Paragraphs
            for p in doc.paragraphs:
                if cur_date:
                    replace_in_runs(p, "Date: 23/10/2026", f"Date: {cur_date}")
                    replace_in_runs(p, "23/10/2026", cur_date)
                if cand_name:
                    replace_in_runs(p, "Mr./Ms. Mangeet Singh", f"Mr./Ms. {cand_name}")
                    replace_in_runs(p, "Mangeet Singh", cand_name)
                    replace_in_runs(p, "Dear Mr. Mangeet Singh,", f"Dear {cand_name},")
                if cand_addr:
                    replace_in_runs(p, "Address: Bhatinda - Punjab", f"Address: {cand_addr}")
                    replace_in_runs(p, "Bhatinda - Punjab", cand_addr)
                if cand_mobile:
                    replace_in_runs(p, "Mobile: 7737383505", f"Mobile: {cand_mobile}")
                    replace_in_runs(p, "7737383505", cand_mobile)
                if cand_email:
                    replace_in_runs(p, "Email ID: -", f"Email ID: {cand_email}")
                if cand_aadhaar and cand_aadhaar != "-":
                    replace_in_runs(p, "Aadhar Number: -", f"Aadhar Number: {cand_aadhaar}")
                if approved_role:
                    replace_in_runs(p, "HDD Operator", approved_role)
                if approved_loc:
                    replace_in_runs(p, "District Sri Ganganagar State Rajasthan.", f"{approved_loc}.")
                    replace_in_runs(p, "District Sri Ganganagar State Rajasthan", approved_loc)
                if joining_date:
                    replace_in_runs(p, "Start Date of Services: 01/11/2026", f"Start Date of Services: {joining_date}")
                    replace_in_runs(p, "01/11/2026", joining_date)

            # LOI Table (Salary & Total)
            for t in doc.tables:
                for row in t.rows:
                    for cell in row.cells:
                        replace_in_cell(cell, "40000", monthly_sal)

        elif is_offer:
            # 1. Offer Letter Paragraphs
            for p in doc.paragraphs:
                if ref_num:
                    replace_in_runs(p, "FFPL/RAJ/2026-27/10/00035", ref_num)
                if cur_date:
                    replace_in_runs(p, "Date: 20th Oct, 2026", f"Date: {cur_date}")
                    replace_in_runs(p, "20th Oct, 2026", cur_date)
                if cand_name:
                    replace_in_runs(p, "Name: Mr. Setu Jat", f"Name: {cand_name}")
                    replace_in_runs(p, "Name:  Mr. Setu Jat", f"Name: {cand_name}")
                    replace_in_runs(p, "Mr. Setu Jat", cand_name)
                    replace_in_runs(p, "Setu Jat", cand_name)
                    replace_in_runs(p, "Dear Mr. Setu Jat,", f"Dear {cand_name},")
                if cand_mobile:
                    replace_in_runs(p, "Mobile -+91 9571024426", f"Mobile: {cand_mobile}")
                    replace_in_runs(p, "9571024426", cand_mobile)
                if approved_role:
                    replace_in_runs(p, "HDD - Tracker", approved_role)
                if approved_loc:
                    replace_in_runs(p, "Presently you will be posted in Behrunda 2 Rajasthan", f"Presently you will be posted in {approved_loc}")
                    replace_in_runs(p, "Behrunda 2 Rajasthan", approved_loc)
                if joining_date:
                    replace_in_runs(p, "Dated: 01/10/2026.", f"Dated: {joining_date}.")
                    replace_in_runs(p, "01/10/2026", joining_date)

            # Offer Letter Table 0 (Annexure II)
            if doc.tables:
                t = doc.tables[0]
                if cand_name and len(t.rows) > 0 and len(t.rows[0].cells) > 1:
                    replace_in_cell(t.rows[0].cells[1], "Mr. Setu Jat", cand_name)
                    replace_in_cell(t.rows[0].cells[1], "Setu Jat", cand_name)

                # Update structured Annexure II compensation rows while preserving cell formatting
                if len(t.rows) >= 28:
                    try:
                        ms_num = float(monthly_sal)
                        sb = LetterGenerationService.calculate_salary_breakdown(ms_num)
                    except (ValueError, TypeError):
                        sb = {}

                    update_cell_value_preserving_style(t.rows[3].cells[1], str(field_values.get("total_ctc_monthly", sb.get("total_ctc_monthly", monthly_sal))))
                    update_cell_value_preserving_style(t.rows[3].cells[2], str(field_values.get("yearly_ctc", sb.get("yearly_ctc", int(float(monthly_sal) * 12)))))
                    update_cell_value_preserving_style(t.rows[4].cells[1], str(field_values.get("total_ctc_monthly", sb.get("total_ctc_monthly", monthly_sal))))
                    update_cell_value_preserving_style(t.rows[4].cells[2], str(field_values.get("yearly_ctc", sb.get("yearly_ctc", int(float(monthly_sal) * 12)))))

                    for r_idx in range(8, min(len(t.rows), 28)):
                        row = t.rows[r_idx]
                        head_name = row.cells[0].text.strip().lower()
                        if "basic" in head_name:
                            update_cell_value_preserving_style(row.cells[1], str(field_values.get("basic_monthly", sb.get("basic_monthly", row.cells[1].text))))
                            update_cell_value_preserving_style(row.cells[2], str(field_values.get("basic_yearly", sb.get("basic_yearly", row.cells[2].text))))
                        elif "others allowances" in head_name:
                            update_cell_value_preserving_style(row.cells[1], str(field_values.get("other_allowance_monthly", sb.get("other_allowance_monthly", row.cells[1].text))))
                            update_cell_value_preserving_style(row.cells[2], str(field_values.get("other_allowance_yearly", sb.get("other_allowance_yearly", row.cells[2].text))))
                        elif "medical allowance" in head_name:
                            update_cell_value_preserving_style(row.cells[1], str(field_values.get("medical_monthly", sb.get("medical_monthly", "45"))))
                            update_cell_value_preserving_style(row.cells[2], str(field_values.get("medical_yearly", sb.get("medical_yearly", "540"))))
                        elif "advance bonus" in head_name:
                            update_cell_value_preserving_style(row.cells[1], str(field_values.get("bonus_monthly", sb.get("bonus_monthly", row.cells[1].text))))
                            update_cell_value_preserving_style(row.cells[2], str(field_values.get("bonus_yearly", sb.get("bonus_yearly", row.cells[2].text))))
                        elif "advance gratuity" in head_name:
                            update_cell_value_preserving_style(row.cells[1], str(field_values.get("gratuity_monthly", sb.get("gratuity_monthly", row.cells[1].text))))
                            update_cell_value_preserving_style(row.cells[2], str(field_values.get("gratuity_yearly", sb.get("gratuity_yearly", row.cells[2].text))))
                        elif "gross salary" in head_name:
                            update_cell_value_preserving_style(row.cells[1], str(field_values.get("gross_monthly", sb.get("gross_monthly", row.cells[1].text))))
                            update_cell_value_preserving_style(row.cells[2], str(field_values.get("gross_yearly", sb.get("gross_yearly", row.cells[2].text))))
                        elif "take home" in head_name and "net" not in head_name:
                            update_cell_value_preserving_style(row.cells[1], str(field_values.get("take_home_monthly", sb.get("take_home_monthly", row.cells[1].text))))
                            update_cell_value_preserving_style(row.cells[2], str(field_values.get("take_home_yearly", sb.get("take_home_yearly", row.cells[2].text))))
                        elif "net take home" in head_name:
                            update_cell_value_preserving_style(row.cells[1], str(field_values.get("net_take_home_monthly", sb.get("net_take_home_monthly", row.cells[1].text))))
                            update_cell_value_preserving_style(row.cells[2], str(field_values.get("net_take_home_yearly", sb.get("net_take_home_yearly", row.cells[2].text))))
                        elif "total ctc" in head_name:
                            update_cell_value_preserving_style(row.cells[1], str(field_values.get("total_ctc_monthly", sb.get("total_ctc_monthly", row.cells[1].text))))
                            update_cell_value_preserving_style(row.cells[2], str(field_values.get("yearly_ctc", sb.get("yearly_ctc", row.cells[2].text))))

        # Also support placeholder tags if custom template with {{placeholders}} was uploaded
        for k, v in field_values.items():
            if isinstance(v, (str, int, float)):
                target = f"{{{{{k}}}}}"
                rep = str(v) if v is not None else ""
                for p in doc.paragraphs:
                    replace_in_runs(p, target, rep)
                for t in doc.tables:
                    for row in t.rows:
                        for cell in row.cells:
                            replace_in_cell(cell, target, rep)

        doc.save(output_path)

    @staticmethod
    def update_letter_draft(
        application_id: uuid.UUID,
        letter_type: str,
        field_values: Dict[str, Any],
        uploaded_docx,
        user: User,
    ) -> CandidateLetter:
        """Update candidate letter draft with modified fields or revised DOCX upload."""
        letter = db.session.execute(
            select(CandidateLetter)
            .where(CandidateLetter.application_id == application_id)
            .where(CandidateLetter.letter_type == letter_type)
            .order_by(CandidateLetter.version.desc(), CandidateLetter.created_at.desc())
        ).scalars().first()

        if not letter:
            raise NotFoundError(f"Candidate letter for '{letter_type}' not found.")

        with atomic():
            if uploaded_docx and uploaded_docx.filename:
                # Save revised docx directly
                uploaded_docx.save(letter.docx_storage_path)
            else:
                # Re-render with merged field values from the pristine master template
                merged_fields = dict(letter.field_values or {})
                merged_fields.update(field_values)

                # If monthly_salary updated, recalculate salary breakdown
                if "monthly_salary" in field_values:
                    try:
                        ms = float(field_values["monthly_salary"])
                        sb = LetterGenerationService.calculate_salary_breakdown(ms)
                        merged_fields.update(sb)
                        merged_fields["total_salary"] = str(int(ms))
                    except ValueError:
                        pass

                tmpl = letter.template or LetterTemplateService.get_active_template(letter_type)
                LetterGenerationService._render_docx(tmpl.storage_path, letter.docx_storage_path, merged_fields, letter_type)
                letter.field_values = merged_fields

            # Invalidate cached pdf to trigger re-generation on demand
            if letter.pdf_storage_path and os.path.exists(letter.pdf_storage_path):
                try:
                    os.remove(letter.pdf_storage_path)
                except Exception:
                    pass
            letter.pdf_storage_path = None
            letter.last_edited_by_id = user.id
            letter.last_edited_at = utc_now()
            letter.version += 1
            letter.status = LETTER_STATUS_DRAFT

        # Automatically re-render PDF so review page can immediately preview latest changes
        try:
            LetterGenerationService.get_or_render_pdf(letter)
        except Exception as e:
            current_app.logger.warning(f"Could not pre-render PDF for {letter_type}: {e}")

        return letter

    @staticmethod
    def get_or_render_pdf(letter: CandidateLetter) -> str:
        """Ensure a high-fidelity PDF version of the candidate letter exists and return its path."""
        if letter.pdf_storage_path and os.path.exists(letter.pdf_storage_path):
            try:
                if os.path.getmtime(letter.pdf_storage_path) >= os.path.getmtime(letter.docx_storage_path):
                    return letter.pdf_storage_path
            except Exception:
                pass

        pdf_path = letter.docx_storage_path.replace(".docx", ".pdf")

        # In testing mode, use ReportLab to avoid COM processes in headless runners
        if current_app.config.get("TESTING") and REPORTLAB_AVAILABLE:
            try:
                c = canvas.Canvas(pdf_path, pagesize=LETTER_PAGESIZE)
                doc = docx.Document(letter.docx_storage_path)
                y = 750
                c.setFont("Helvetica-Bold", 14)
                c.drawString(50, y, f"{'Letter of Intent' if letter.letter_type == TEMPLATE_TYPE_LOI else 'Appointment / Offer Letter'}")
                y -= 30
                c.setFont("Helvetica", 10)
                for p in doc.paragraphs:
                    text = p.text.strip()
                    if text:
                        words = text.split()
                        line = ""
                        for word in words:
                            if len(line) + len(word) > 80:
                                c.drawString(50, y, line)
                                y -= 14
                                line = word + " "
                                if y < 50:
                                    c.showPage()
                                    y = 750
                                    c.setFont("Helvetica", 10)
                            else:
                                line += word + " "
                        if line:
                            c.drawString(50, y, line)
                            y -= 16
                            if y < 50:
                                c.showPage()
                                y = 750
                                c.setFont("Helvetica", 10)
                c.save()
                if os.path.exists(pdf_path):
                    letter.pdf_storage_path = pdf_path
                    db.session.commit()
                    return pdf_path
            except Exception as e:
                current_app.logger.error(f"Test PDF rendering error: {e}")

        # Native conversion (Word COM or docx2pdf or ReportLab fallback)
        converted = convert_docx_to_pdf_native(letter.docx_storage_path, pdf_path)
        if converted and os.path.exists(pdf_path):
            letter.pdf_storage_path = pdf_path
            db.session.commit()
            return pdf_path

        raise ValidationError("Failed to convert reviewed candidate letter to PDF. Please verify Microsoft Word or document converter.")

    @staticmethod
    def send_letters_by_email(
        application_id: uuid.UUID,
        user: User,
        force_resend: bool = False,
        document_scope: str = "both",
    ) -> Dict[str, Any]:
        """Validate, package, and email candidate's Letter of Intent and/or Offer Letter."""
        app = db.session.execute(
            select(CandidateApplication).where(CandidateApplication.id == application_id)
        ).scalar_one_or_none()

        if not app:
            raise NotFoundError("Application record not found.")

        if app.status != APPLICATION_STATUS_APPROVED:
            raise ValidationError(
                f"Candidate application '{app.application_number}' has status '{app.status}'. "
                "Letters can only be sent for APPROVED candidates."
            )

        if not app.email or "@" not in app.email:
            raise ValidationError(
                f"Candidate application '{app.application_number}' does not have a valid registered email address."
            )

        include_loi = document_scope in ("both", TEMPLATE_TYPE_LOI, "loi")
        include_offer = document_scope in ("both", TEMPLATE_TYPE_OFFER, "offer")

        loi_letter = None
        offer_letter = None

        if include_loi:
            loi_letter = db.session.execute(
                select(CandidateLetter)
                .where(CandidateLetter.application_id == app.id)
                .where(CandidateLetter.letter_type == TEMPLATE_TYPE_LOI)
                .order_by(CandidateLetter.version.desc(), CandidateLetter.created_at.desc())
            ).scalars().first()
            if not loi_letter:
                raise ValidationError("Letter of Intent draft has not been generated for review.")

        if include_offer:
            offer_letter = db.session.execute(
                select(CandidateLetter)
                .where(CandidateLetter.application_id == app.id)
                .where(CandidateLetter.letter_type == TEMPLATE_TYPE_OFFER)
                .order_by(CandidateLetter.version.desc(), CandidateLetter.created_at.desc())
            ).scalars().first()
            if not offer_letter:
                raise ValidationError("Offer Letter draft has not been generated for review.")

        # Safeguard: prevent accidental duplicate dispatch unless explicit
        if not force_resend:
            if loi_letter and loi_letter.status == LETTER_STATUS_SENT:
                raise ValidationError(
                    f"Letter of Intent has already been sent to candidate '{app.full_name}' ({app.email}) on "
                    f"{loi_letter.sent_at.strftime('%d %b %Y, %I:%M %p')}. To resend, please confirm explicit re-dispatch."
                )
            if offer_letter and offer_letter.status == LETTER_STATUS_SENT:
                raise ValidationError(
                    f"Offer Letter has already been sent to candidate '{app.full_name}' ({app.email}) on "
                    f"{offer_letter.sent_at.strftime('%d %b %Y, %I:%M %p')}. To resend, please confirm explicit re-dispatch."
                )

        # Validate mandatory placeholder fields: joining_date
        loi_joining = (loi_letter.field_values or {}).get("joining_date", "").strip() if loi_letter else ""
        offer_joining = (offer_letter.field_values or {}).get("joining_date", "").strip() if offer_letter else ""
        joining_str = offer_joining or loi_joining

        if (include_loi and not loi_joining) or (include_offer and not offer_joining):
            raise ValidationError(
                "Missing mandatory field: 'Joining Date'. Please specify the candidate's joining date "
                "in the letter review screen before sending."
            )

        # Prepare attachments: generate and strictly validate candidate-specific PDFs
        attachments = []
        safe_cand_name = app.full_name.replace(" ", "_")

        if include_loi and loi_letter:
            loi_file = LetterGenerationService.get_or_render_pdf(loi_letter)
            if not loi_file or not loi_file.endswith(".pdf") or not os.path.exists(loi_file):
                raise ValidationError("Could not generate final PDF for Letter of Intent. Email dispatch aborted.")
            attachments.append({
                "filename": f"Letter_of_Intent_{safe_cand_name}.pdf",
                "filepath": loi_file,
            })

        if include_offer and offer_letter:
            offer_file = LetterGenerationService.get_or_render_pdf(offer_letter)
            if not offer_file or not offer_file.endswith(".pdf") or not os.path.exists(offer_file):
                raise ValidationError("Could not generate final PDF for Offer Letter. Email dispatch aborted.")
            attachments.append({
                "filename": f"Offer_Letter_{safe_cand_name}.pdf",
                "filepath": offer_file,
            })

        if not attachments:
            raise ValidationError("No document attachments were selected for dispatch.")

        subject = "Congratulations — Your Application Has Been Approved"
        role_title = app.role_applied

        doc_mention = "official <strong>Letter of Intent</strong> and formal <strong>Offer Letter</strong>"
        if not include_loi:
            doc_mention = "formal <strong>Offer Letter</strong>"
        elif not include_offer:
            doc_mention = "official <strong>Letter of Intent</strong>"

        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
            <div style="background-color: #4f46e5; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Fiber Force Private Limited</h1>
                <p style="color: #e0e7ff; margin: 5px 0 0; font-size: 14px;">Official Candidate Appointment & Enrollment</p>
            </div>
            <div style="padding: 28px; background-color: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="font-size: 16px; font-weight: bold;">Dear {app.full_name},</p>
                <p>We are delighted to congratulate you on your selection! Your candidate application (<strong>{app.application_number}</strong>) has been officially reviewed and <strong>Approved</strong>.</p>
                <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 14px 18px; margin: 20px 0; border-radius: 0 4px 4px 0;">
                    <p style="margin: 0; font-size: 14px;"><strong>Designation:</strong> {role_title}</p>
                    <p style="margin: 4px 0 0; font-size: 14px;"><strong>Assigned Location:</strong> District {app.district}, {app.current_state}</p>
                    <p style="margin: 4px 0 0; font-size: 14px;"><strong>Service Commencement / Joining Date:</strong> {joining_str}</p>
                </div>
                <p>Please find attached your {doc_mention} including the terms of engagement and compensation structure.</p>
                <p>Please review the attached documents, sign the acceptance copy, and present it on or before your stipulated service commencement date.</p>
                <p style="margin-top: 24px;">Welcome aboard! We look forward to a rewarding and successful journey together.</p>
                <p style="margin-top: 28px; font-size: 14px; color: #64748b;">
                    Sincerely,<br/>
                    <strong>HR Department</strong><br/>
                    Fiber Force Private Limited
                </p>
            </div>
        </div>
        """

        text_body = f"""
Dear {app.full_name},

Congratulations! Your candidate application ({app.application_number}) has been approved.

Position: {role_title}
Location: District {app.district}, {app.current_state}
Joining Date: {joining_str}

Please find attached your official documentation. Kindly sign and return the acceptance copy by your service start date.

Sincerely,
HR Department
Fiber Force Private Limited
        """

        try:
            send_result = EmailService.send_email(
                to_email=app.email,
                subject=subject,
                html_body=html_body,
                text_body=text_body,
                attachments=attachments,
            )

            now = utc_now()
            with atomic():
                if include_loi and loi_letter:
                    loi_letter.status = LETTER_STATUS_SENT
                    loi_letter.sent_at = now
                    loi_letter.sent_by_id = user.id
                    loi_letter.email_recipient = app.email
                    loi_letter.email_status = "SENT"
                    loi_letter.email_error = None

                if include_offer and offer_letter:
                    offer_letter.status = LETTER_STATUS_SENT
                    offer_letter.sent_at = now
                    offer_letter.sent_by_id = user.id
                    offer_letter.email_recipient = app.email
                    offer_letter.email_status = "SENT"
                    offer_letter.email_error = None

                audit = AuditLog(
                    action="LETTERS_SENT",
                    user_id=user.id,
                    resource="candidate_applications",
                    resource_id=str(app.id),
                    details={
                        "application_number": app.application_number,
                        "recipient_email": app.email,
                        "joining_date": joining_str,
                        "document_scope": document_scope,
                        "mode": send_result.get("mode"),
                        "message_id": send_result.get("message_id"),
                    },
                )
                db.session.add(audit)

            return {
                "success": True,
                "message": f"Letters dispatched successfully to '{app.email}'.",
                "recipient": app.email,
                "sent_at": now.isoformat(),
                "delivery_mode": send_result.get("mode"),
                "document_scope": document_scope,
            }
        except Exception as e:
            with atomic():
                if include_loi and loi_letter:
                    loi_letter.email_status = "FAILED"
                    loi_letter.email_error = str(e)
                if include_offer and offer_letter:
                    offer_letter.email_status = "FAILED"
                    offer_letter.email_error = str(e)

            raise ValidationError(f"Failed to email letters to '{app.email}': {str(e)}")
