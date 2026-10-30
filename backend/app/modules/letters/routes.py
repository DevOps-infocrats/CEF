import os
import uuid
from flask import Blueprint, request, g, send_file
from app.common.responses import api_response
from app.common.errors.exceptions import ValidationError, NotFoundError, ForbiddenError
from app.common.permissions.decorators import require_auth
from app.common.permissions.authorization import AuthorizationEvaluator
from app.modules.letters.models import (
    TEMPLATE_TYPE_LOI,
    TEMPLATE_TYPE_OFFER,
    VALID_TEMPLATE_TYPES,
)
from app.modules.letters.services import (
    LetterTemplateService,
    LetterGenerationService,
    resolve_storage_path,
)

letters_bp = Blueprint("letters", __name__, url_prefix="/api/v1")


def _resolve_uuid(id_str: str) -> uuid.UUID:
    try:
        return uuid.UUID(id_str)
    except ValueError:
        raise ValidationError(f"Invalid UUID: '{id_str}'")


# ==============================================================================
# MASTER TEMPLATES MANAGEMENT
# ==============================================================================

@letters_bp.route("/letters/templates/<string:template_type>", methods=["GET"])
@letters_bp.route("/templates/<string:template_type>", methods=["GET"])
@require_auth
def get_template_metadata(template_type: str):
    """Get active master template metadata, version, and placeholder mappings."""
    if template_type not in VALID_TEMPLATE_TYPES:
        raise ValidationError(f"Invalid template type: '{template_type}'. Expected 'letter_of_intent' or 'offer_letter'.")

    tmpl = LetterTemplateService.get_active_template(template_type)
    tmpl_path = resolve_storage_path(tmpl.storage_path)
    file_exists = bool(tmpl_path and os.path.exists(tmpl_path))
    file_size = os.path.getsize(tmpl_path) if file_exists else 0

    return api_response(
        data={
            "id": str(tmpl.id),
            "template_type": tmpl.template_type,
            "name": tmpl.name,
            "filename": tmpl.filename,
            "version": tmpl.version,
            "is_active": tmpl.is_active,
            "file_exists": file_exists,
            "file_size": file_size,
            "field_mappings": tmpl.field_mappings or [],
            "download_url": f"/api/v1/letters/templates/{template_type}/download",
            "created_at": tmpl.created_at.isoformat() if tmpl.created_at else None,
            "updated_at": tmpl.updated_at.isoformat() if tmpl.updated_at else None,
        },
        message=f"Active '{template_type}' master template metadata retrieved.",
        status_code=200,
    )


@letters_bp.route("/letters/templates/<string:template_type>/upload", methods=["POST"])
@letters_bp.route("/templates/<string:template_type>/upload", methods=["POST"])
@require_auth
def upload_master_template(template_type: str):
    """Upload and activate a new version of the master Word (.docx) template."""
    user = g.current_user
    if not (
        AuthorizationEvaluator.has_required_permission(user, "users:manage")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:approve")
        or "admin" in (user.roles or [])
    ):
        raise ForbiddenError("Only authorized administrators or decision-makers may manage master templates.")

    if template_type not in VALID_TEMPLATE_TYPES:
        raise ValidationError(f"Invalid template type: '{template_type}'")

    if "file" not in request.files:
        raise ValidationError("A file payload with key 'file' must be supplied.")

    file = request.files["file"]
    new_tmpl = LetterTemplateService.upload_new_template(template_type, file, user)
    new_tmpl_path = resolve_storage_path(new_tmpl.storage_path)
    file_exists = bool(new_tmpl_path and os.path.exists(new_tmpl_path))
    file_size = os.path.getsize(new_tmpl_path) if file_exists else 0

    return api_response(
        data={
            "id": str(new_tmpl.id),
            "template_type": new_tmpl.template_type,
            "name": new_tmpl.name,
            "filename": new_tmpl.filename,
            "version": new_tmpl.version,
            "is_active": new_tmpl.is_active,
            "file_exists": file_exists,
            "file_size": file_size,
            "field_mappings": new_tmpl.field_mappings,
            "download_url": f"/api/v1/letters/templates/{template_type}/download",
            "created_at": new_tmpl.created_at.isoformat() if new_tmpl.created_at else None,
        },
        message=f"Master template for '{template_type}' upgraded to version {new_tmpl.version} successfully.",
        status_code=201,
    )


@letters_bp.route("/letters/templates/<string:template_type>/download", methods=["GET"])
@letters_bp.route("/templates/<string:template_type>/download", methods=["GET"])
@require_auth
def download_master_template(template_type: str):
    """Download the active master Word template."""
    tmpl = LetterTemplateService.get_active_template(template_type)
    tmpl_path = resolve_storage_path(tmpl.storage_path)

    if not os.path.exists(tmpl_path):
        raise NotFoundError("Master template file not found on disk.")

    resp = send_file(
        tmpl_path,
        as_attachment=True,
        download_name=tmpl.filename,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        conditional=False,
        max_age=0,
    )
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp


# ==============================================================================
# CANDIDATE LETTER WORKFLOW & PREVIEW
# ==============================================================================

@letters_bp.route("/applications/<string:app_id>/letters", methods=["GET"])
@letters_bp.route("/candidates/<string:app_id>/letters", methods=["GET"])
@require_auth
def get_candidate_letters(app_id: str):
    """Fetch or initialize generated letter drafts for an approved candidate application."""
    user = g.current_user
    app_uuid = _resolve_uuid(app_id)

    user_roles = getattr(user, "role_names", []) or []
    can_view = (
        AuthorizationEvaluator.has_required_permission(user, "documents:view")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:approve")
        or AuthorizationEvaluator.has_required_permission(user, "users:manage")
        or AuthorizationEvaluator.has_required_permission(user, "letters:view")
        or "admin" in user_roles
    )
    if not can_view:
        from app.modules.candidates.models import CandidateApplication
        from app.extensions import db
        app_obj = db.session.get(CandidateApplication, app_uuid)
        if not app_obj:
            raise NotFoundError("Candidate application record not found.")
        if app_obj.user_id != user.id:
            raise ForbiddenError("You are not authorized to view letters for this application.")

    letters_data = LetterGenerationService.get_or_create_candidate_letters(app_uuid, user)

    return api_response(
        data=letters_data,
        message="Candidate letters retrieved successfully.",
        status_code=200,
    )


@letters_bp.route("/applications/<string:app_id>/letters/<string:letter_type>", methods=["PATCH"])
@letters_bp.route("/candidates/<string:app_id>/letters/<string:letter_type>", methods=["PATCH"])
@require_auth
def update_candidate_letter(app_id: str, letter_type: str):
    """Save edits, update placeholders, or upload revised DOCX for a candidate's letter draft."""
    user = g.current_user
    app_uuid = _resolve_uuid(app_id)

    user_roles = getattr(user, "role_names", []) or []
    can_edit = (
        AuthorizationEvaluator.has_required_permission(user, "candidates:approve")
        or AuthorizationEvaluator.has_required_permission(user, "users:manage")
        or AuthorizationEvaluator.has_required_permission(user, "letters:generate")
        or "admin" in user_roles
    )
    if not can_edit:
        raise ForbiddenError("Missing required permission to edit or save candidate letter drafts.")

    if letter_type not in VALID_TEMPLATE_TYPES:
        raise ValidationError(f"Invalid letter type: '{letter_type}'")

    field_values = {}
    text_edits = None
    paragraphs = None
    table_cells = None
    uploaded_docx = None

    if request.is_json:
        data = request.get_json() or {}
        field_values = data.get("field_values", {})
        text_edits = data.get("text_edits")
        paragraphs = data.get("paragraphs")
        table_cells = data.get("table_cells")
    elif request.form:
        import json
        raw_fields = request.form.get("field_values")
        if raw_fields:
            try:
                field_values = json.loads(raw_fields)
            except Exception:
                raise ValidationError("Invalid JSON in 'field_values' form parameter.")
        raw_text_edits = request.form.get("text_edits")
        if raw_text_edits:
            try:
                text_edits = json.loads(raw_text_edits)
            except Exception:
                pass
        raw_paragraphs = request.form.get("paragraphs")
        if raw_paragraphs:
            try:
                paragraphs = json.loads(raw_paragraphs)
            except Exception:
                pass
        raw_table_cells = request.form.get("table_cells")
        if raw_table_cells:
            try:
                table_cells = json.loads(raw_table_cells)
            except Exception:
                pass
        if "file" in request.files:
            uploaded_docx = request.files["file"]

    updated_letter = LetterGenerationService.update_letter_draft(
        application_id=app_uuid,
        letter_type=letter_type,
        field_values=field_values,
        uploaded_docx=uploaded_docx,
        user=user,
        text_edits=text_edits,
        paragraphs=paragraphs,
        table_cells=table_cells,
    )

    return api_response(
        data=LetterGenerationService._serialize_letter(updated_letter),
        message=f"Candidate {letter_type} draft updated successfully.",
        status_code=200,
    )


@letters_bp.route("/applications/<string:app_id>/joining-date", methods=["PATCH", "PUT"])
@letters_bp.route("/candidates/<string:app_id>/joining-date", methods=["PATCH", "PUT"])
@require_auth
def update_joining_date(app_id: str):
    """Update candidate joining date across applications and generated letter drafts."""
    user = g.current_user
    app_uuid = _resolve_uuid(app_id)

    user_roles = getattr(user, "role_names", []) or []
    can_edit = (
        AuthorizationEvaluator.has_required_permission(user, "candidates:approve")
        or AuthorizationEvaluator.has_required_permission(user, "users:manage")
        or AuthorizationEvaluator.has_required_permission(user, "letters:generate")
        or "admin" in user_roles
    )
    if not can_edit:
        raise ForbiddenError("Missing required permission to edit candidate joining date.")

    data = request.get_json(silent=True) or {}
    raw_date = data.get("joining_date")
    if not raw_date or not str(raw_date).strip():
        raise ValidationError("Field 'joining_date' is required.")

    normalized_date = LetterGenerationService.validate_and_normalize_joining_date(str(raw_date))

    from app.modules.candidates.models import CandidateApplication
    from app.extensions import db
    app_obj = db.session.get(CandidateApplication, app_uuid)
    if not app_obj:
        raise NotFoundError("Candidate application not found.")

    app_obj.joining_date = normalized_date

    # Ensure letter drafts exist and update LOI and Offer letter
    LetterGenerationService.get_or_create_candidate_letters(app_uuid, user)
    updated_loi = LetterGenerationService.update_letter_draft(
        application_id=app_uuid,
        letter_type=TEMPLATE_TYPE_LOI,
        field_values={"joining_date": normalized_date},
        user=user,
    )

    db.session.commit()

    return api_response(
        data={
            "application_id": str(app_obj.id),
            "joining_date": normalized_date,
            "letter_of_intent": LetterGenerationService._serialize_letter(updated_loi),
        },
        message=f"Joining Date updated successfully to {normalized_date}.",
        status_code=200,
    )


@letters_bp.route("/applications/<string:app_id>/letters/<string:letter_type>/download", methods=["GET"])
@letters_bp.route("/candidates/<string:app_id>/letters/<string:letter_type>/download", methods=["GET"])
@require_auth
def download_candidate_letter(app_id: str, letter_type: str):
    """Download candidate letter in DOCX or PDF format."""
    user = g.current_user
    app_uuid = _resolve_uuid(app_id)
    doc_format = request.args.get("format", "docx").lower()

    user_roles = getattr(user, "role_names", []) or []
    can_download = (
        AuthorizationEvaluator.has_required_permission(user, "documents:view")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:approve")
        or AuthorizationEvaluator.has_required_permission(user, "users:manage")
        or AuthorizationEvaluator.has_required_permission(user, "letters:view")
        or "admin" in user_roles
    )
    if not can_download:
        from app.modules.candidates.models import CandidateApplication
        from app.extensions import db
        app_obj = db.session.get(CandidateApplication, app_uuid)
        if not app_obj:
            raise NotFoundError("Candidate application record not found.")
        if app_obj.user_id != user.id:
            raise ForbiddenError("You are not authorized to download letters for this application.")

    from app.modules.letters.models import CandidateLetter
    from app.modules.candidates.models import CandidateApplication
    from sqlalchemy import select
    from app.extensions import db

    letter = db.session.execute(
        select(CandidateLetter)
        .where(CandidateLetter.application_id == app_uuid)
        .where(CandidateLetter.letter_type == letter_type)
        .order_by(CandidateLetter.version.desc(), CandidateLetter.created_at.desc())
    ).scalars().first()

    cand_app_obj = None
    if not letter:
        letters_data = LetterGenerationService.get_or_create_candidate_letters(app_uuid, user)
        cand_app = letters_data.get("application", {})
        safe_name = (cand_app.get("full_name") or "candidate").replace(" ", "_")
        letter = db.session.execute(
            select(CandidateLetter)
            .where(CandidateLetter.application_id == app_uuid)
            .where(CandidateLetter.letter_type == letter_type)
            .order_by(CandidateLetter.version.desc(), CandidateLetter.created_at.desc())
        ).scalars().first()
    else:
        cand_app_obj = db.session.get(CandidateApplication, app_uuid)
        safe_name = (cand_app_obj.full_name if cand_app_obj else "candidate").replace(" ", "_")

    if not letter:
        raise NotFoundError("Letter not found.")

    is_inline = request.args.get("inline", "0").lower() in ("1", "true", "yes")

    if doc_format == "pdf":
        pdf_path = LetterGenerationService.get_or_render_pdf(letter)
        if pdf_path.endswith(".pdf") and os.path.exists(pdf_path):
            resp = send_file(
                pdf_path,
                as_attachment=not is_inline,
                download_name=f"{letter_type}_{safe_name}.pdf",
                mimetype="application/pdf",
                conditional=False,
                max_age=0,
            )
            resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            resp.headers["Pragma"] = "no-cache"
            resp.headers["Expires"] = "0"
            return resp

    docx_path = LetterGenerationService.ensure_candidate_docx_exists(letter)

    resp = send_file(
        docx_path,
        as_attachment=True,
        download_name=f"{letter_type}_{safe_name}.docx",
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        conditional=False,
        max_age=0,
    )
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp


@letters_bp.route("/applications/<string:app_id>/letters/send", methods=["POST"])
@letters_bp.route("/candidates/<string:app_id>/letters/send", methods=["POST"])
@require_auth
def send_candidate_letters(app_id: str):
    """Dispatch both Letter of Intent and Offer Letter via email to the approved candidate."""
    user = g.current_user

    # Require candidate approval or administrative permission
    if not (
        AuthorizationEvaluator.has_required_permission(user, "candidates:approve")
        or AuthorizationEvaluator.has_required_permission(user, "users:manage")
        or "admin" in (user.roles or [])
    ):
        raise ForbiddenError("Only authorized decision-makers or administrators may dispatch official letters.")

    app_uuid = _resolve_uuid(app_id)
    data = request.get_json(silent=True) or {}
    force_resend = bool(data.get("force_resend", False))
    document_scope = str(data.get("document_scope", "both")).lower()

    result = LetterGenerationService.send_letters_by_email(
        application_id=app_uuid,
        user=user,
        force_resend=force_resend,
        document_scope=document_scope,
    )

    return api_response(
        data=result,
        message=result["message"],
        status_code=200,
    )


@letters_bp.route("/applications/<string:app_id>/letters/email-preview", methods=["GET"])
@letters_bp.route("/candidates/<string:app_id>/letters/email-preview", methods=["GET"])
@require_auth
def preview_candidate_email(app_id: str):
    """Preview the exact congratulation email to be sent to an approved candidate."""
    user = g.current_user

    if not (
        AuthorizationEvaluator.has_required_permission(user, "candidates:approve")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:read")
        or AuthorizationEvaluator.has_required_permission(user, "documents:view")
        or AuthorizationEvaluator.has_required_permission(user, "users:manage")
        or "admin" in (user.roles or [])
    ):
        raise ForbiddenError("You are not authorized to preview candidate letters.")

    app_uuid = _resolve_uuid(app_id)
    document_scope = request.args.get("document_scope", "both").lower()

    preview_data = LetterGenerationService.preview_congratulations_email(
        application_id=app_uuid,
        user=user,
        document_scope=document_scope,
    )

    return api_response(
        data=preview_data,
        message="Congratulation email preview generated successfully.",
        status_code=200,
    )


@letters_bp.route("/letters/smtp-status", methods=["GET"])
@require_auth
def get_smtp_status():
    """Check current SMTP configuration status and test connection."""
    user = g.current_user
    user_roles = user.role_names if hasattr(user, "role_names") else (user.roles or [])
    if not (
        AuthorizationEvaluator.has_required_permission(user, "users:manage")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:approve")
        or AuthorizationEvaluator.has_required_permission(user, "letters:generate")
        or "admin" in user_roles
    ):
        raise ForbiddenError("Only authorized personnel may inspect SMTP configuration.")

    test_to = request.args.get("test_email")
    from app.modules.letters.services import EmailService
    result = EmailService.test_smtp_connection(to_test_email=test_to)
    return api_response(
        data=result,
        message=result["message"],
        status_code=200,
    )


def _get_client_metadata() -> tuple[str, str]:
    """Extract client IP and user-agent from request."""
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "unknown")
    if "," in ip:
        ip = ip.split(",")[0].strip()
    user_agent = request.headers.get("User-Agent", "unknown")[:250]
    return ip, user_agent


@letters_bp.route("/applications/<string:app_id>/letters/accept", methods=["POST"])
@letters_bp.route("/candidates/<string:app_id>/letters/accept", methods=["POST"])
@require_auth
def accept_candidate_offer(app_id: str):
    """Candidate accepts the formal offer letter and agreement."""
    user = g.current_user
    app_uuid = _resolve_uuid(app_id)
    ip_address, user_agent = _get_client_metadata()

    result = LetterGenerationService.accept_candidate_offer(
        application_id=app_uuid,
        user=user,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return api_response(
        data=result,
        message=result["message"],
        status_code=200,
    )



