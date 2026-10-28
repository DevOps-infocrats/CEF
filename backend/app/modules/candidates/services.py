import os
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from werkzeug.utils import secure_filename
from werkzeug.datastructures import FileStorage
from flask import current_app
from sqlalchemy import select
from app.extensions import db
from app.common.database.transactions import atomic
from app.common.errors.exceptions import ValidationError, NotFoundError, ForbiddenError
from app.common.permissions.authorization import AuthorizationEvaluator
from app.modules.auth.models import AuditLog
from app.modules.candidates.models import (
    CandidateApplication,
    CandidateDocument,
    CandidateVerificationItem,
    CandidateApplicationDistrict,
    CandidateApplicationBlock,
    DOCUMENT_CATEGORIES,
    DOCUMENT_CATEGORIES_MANDATORY,
    DOCUMENT_CATEGORIES_BANK,
    VERIFICATION_STATUS_PENDING,
    VERIFICATION_STATUS_DONE,
    VERIFICATION_STATUS_REJECTED,
    APPLICATION_STATUS_PENDING,
    APPLICATION_STATUS_IN_PROGRESS,
    APPLICATION_STATUS_COMPLETE,
    APPLICATION_STATUS_APPROVED,
    APPLICATION_STATUS_REJECTED,
)
from app.modules.locations.models import LocationDistrict, LocationBlock

# File upload security configuration
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/x-pdf",
    "image/png",
    "image/x-png",
    "image/jpeg",
    "image/pjpeg",
    "image/jpg",
}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def generate_application_number() -> str:
    """Generate a formal unique application reference ID on the backend."""
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    unique_suffix = uuid.uuid4().hex[:6].upper()
    return f"CEF-APP-{date_str}-{unique_suffix}"


def get_storage_base_dir() -> str:
    """Return the absolute path to protected document storage directory."""
    base_dir = os.path.join(current_app.root_path, "..", "storage", "documents")
    os.makedirs(base_dir, exist_ok=True)
    return os.path.abspath(base_dir)


def resolve_document_file_path(doc: Optional[CandidateDocument]) -> Optional[str]:
    """Resolve and verify existence of a candidate document on physical storage."""
    if not doc:
        return None

    # 1. Direct path check if set and exists
    if doc.file_path and os.path.exists(doc.file_path):
        return os.path.abspath(doc.file_path)

    base_dir = get_storage_base_dir()

    # 2. Check canonical location: base_dir / str(user_id) / storage_filename
    if doc.storage_filename and doc.user_id:
        user_path = os.path.join(base_dir, str(doc.user_id), doc.storage_filename)
        if os.path.exists(user_path):
            return os.path.abspath(user_path)

    # 3. Check directly under base_dir / storage_filename
    if doc.storage_filename:
        flat_path = os.path.join(base_dir, doc.storage_filename)
        if os.path.exists(flat_path):
            return os.path.abspath(flat_path)

    # 4. Check relative to application root
    if doc.file_path:
        norm_path = doc.file_path.replace("/", os.sep).replace("\\", os.sep)
        if os.path.exists(norm_path):
            return os.path.abspath(norm_path)
        app_rel_path = os.path.abspath(os.path.join(current_app.root_path, "..", norm_path))
        if os.path.exists(app_rel_path):
            return app_rel_path

def _clean_str(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def _clean_decimal(val: Any) -> Optional[Decimal]:
    if val is None or val == "":
        return None
    try:
        return Decimal(str(val))
    except Exception:
        return None


class CandidateService:
    """Business operations and state persistence for candidate applications and documents."""

    @staticmethod
    def save_document(
        user_id: uuid.UUID,
        category: str,
        file: FileStorage,
    ) -> CandidateDocument:
        """Validate, store securely on disk, and record metadata for a candidate document."""
        if category not in DOCUMENT_CATEGORIES:
            raise ValidationError(f"Invalid document category '{category}'.")

        if not file or not file.filename:
            raise ValidationError("No file provided for upload.")

        original_filename = secure_filename(file.filename) or "document"
        _, ext = os.path.splitext(original_filename)
        ext = ext.lower()

        if ext not in ALLOWED_EXTENSIONS:
            raise ValidationError(
                f"File type '{ext}' is not permitted. Allowed types: PDF, PNG, JPG, JPEG."
            )

        content_type = file.mimetype or "application/octet-stream"
        # Normalize generic octet-stream based on validated extension
        if content_type in ("application/octet-stream", ""):
            if ext == ".pdf":
                content_type = "application/pdf"
            elif ext in {".jpg", ".jpeg"}:
                content_type = "image/jpeg"
            elif ext == ".png":
                content_type = "image/png"

        if content_type not in ALLOWED_MIME_TYPES:
            raise ValidationError(
                f"Invalid MIME type '{content_type}'. Must be PDF or image (PNG/JPEG)."
            )

        # Check file size (stream size)
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)

        if file_size <= 0:
            raise ValidationError("Uploaded file cannot be empty.")
        if file_size > MAX_FILE_SIZE_BYTES:
            raise ValidationError(
                f"File size exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB."
            )

        # Prepare user storage directory
        user_dir = os.path.join(get_storage_base_dir(), str(user_id))
        os.makedirs(user_dir, exist_ok=True)

        storage_filename = f"{uuid.uuid4().hex}{ext}"
        storage_filepath = os.path.join(user_dir, storage_filename)

        # Save file to disk outside the DB transaction to avoid blocking connection pool
        file.save(storage_filepath)

        old_file_to_remove = None
        try:
            with atomic():
                # If user already uploaded a document in this category that is not yet linked to an application, replace it
                existing_doc = db.session.execute(
                    select(CandidateDocument)
                    .where(CandidateDocument.user_id == user_id)
                    .where(CandidateDocument.category == category)
                    .where(CandidateDocument.application_id.is_(None))
                ).scalar_one_or_none()

                if existing_doc:
                    old_file_to_remove = existing_doc.file_path
                    db.session.delete(existing_doc)

                # Persist document record
                doc = CandidateDocument(
                    user_id=user_id,
                    category=category,
                    original_filename=original_filename,
                    storage_filename=storage_filename,
                    file_path=storage_filepath,
                    content_type=content_type,
                    file_size=file_size,
                )
                db.session.add(doc)

            # Cleanup replaced file on disk only after DB transaction commits
            if old_file_to_remove and os.path.exists(old_file_to_remove):
                try:
                    os.remove(old_file_to_remove)
                except OSError:
                    pass

        except Exception:
            # If DB insert fails, clean up the newly saved file
            if os.path.exists(storage_filepath):
                try:
                    os.remove(storage_filepath)
                except OSError:
                    pass
            raise

        return doc

    @staticmethod
    def delete_document(doc_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Safely remove an unattached document and its file."""
        doc = db.session.get(CandidateDocument, doc_id)
        if not doc:
            raise NotFoundError("Document not found.")

        if doc.user_id != user_id:
            raise ForbiddenError("Unauthorized to delete this document.")

        if doc.application_id is not None:
            raise ValidationError("Cannot delete document already committed to a submitted application.")

        # Remove physical file
        if os.path.exists(doc.file_path):
            try:
                os.remove(doc.file_path)
            except OSError:
                pass

        with atomic():
            db.session.delete(doc)

    @staticmethod
    def create_application(
        user_id: uuid.UUID,
        data: Dict[str, Any],
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> CandidateApplication:
        """Create and persist a candidate application and link uploaded documents inside an atomic transaction."""
        app_id = uuid.uuid4()
        app_number = generate_application_number()

        # Handle permanent address sync if flagged
        is_same = bool(data.get("is_permanent_same", False))
        if is_same:
            perm_line1 = data.get("current_address_line1")
            perm_line2 = data.get("current_address_line2")
            perm_city = data.get("current_city")
            perm_state = data.get("current_state")
            perm_pincode = data.get("current_pincode")
            perm_country = data.get("current_country") or "India"
        else:
            perm_line1 = data.get("permanent_address_line1")
            perm_line2 = data.get("permanent_address_line2")
            perm_city = data.get("permanent_city")
            perm_state = data.get("permanent_state")
            perm_pincode = data.get("permanent_pincode")
            perm_country = data.get("permanent_country") or "India"

        # Resolve documents to link: link whatever unattached documents the user uploaded (uploads are optional)
        staged_docs: List[CandidateDocument] = list(
            db.session.execute(
                select(CandidateDocument)
                .where(CandidateDocument.user_id == user_id)
                .where(CandidateDocument.application_id.is_(None))
            ).scalars().all()
        )

        with atomic():
            # Prepare district and block strings & records
            district_ids = data.get("district_ids") or []
            block_ids = data.get("block_ids") or []

            app_districts = []
            app_blocks = []
            dist_map = {}

            # Reuse validated models from schema validation if present, avoiding redundant DB queries
            if district_ids:
                if "_validated_districts" in data:
                    dist_models = data["_validated_districts"]
                else:
                    dist_models = list(
                        db.session.execute(
                            select(LocationDistrict).where(LocationDistrict.id.in_(district_ids))
                        ).scalars().all()
                    )
                dist_map = {d.id: d.name for d in dist_models}
                district_summary = ", ".join(d.name for d in dist_models)
                for d in dist_models:
                    app_districts.append(
                        CandidateApplicationDistrict(
                            id=uuid.uuid4(),
                            application_id=app_id,
                            district_id=d.id,
                            district_name=d.name,
                        )
                    )
            else:
                district_summary = (data.get("district") or "").strip()
                if district_summary:
                    for d_name in [s.strip() for s in district_summary.split(",") if s.strip()]:
                        app_districts.append(
                            CandidateApplicationDistrict(
                                id=uuid.uuid4(),
                                application_id=app_id,
                                district_id=None,
                                district_name=d_name,
                            )
                        )

            if block_ids:
                if "_validated_blocks" in data:
                    blk_models = data["_validated_blocks"]
                else:
                    blk_models = list(
                        db.session.execute(
                            select(LocationBlock).where(LocationBlock.id.in_(block_ids))
                        ).scalars().all()
                    )
                block_summary = ", ".join(b.name for b in blk_models)
                for b in blk_models:
                    d_name = dist_map.get(b.district_id)
                    app_blocks.append(
                        CandidateApplicationBlock(
                            id=uuid.uuid4(),
                            application_id=app_id,
                            block_id=b.id,
                            district_id=b.district_id,
                            block_name=b.name,
                            district_name=d_name,
                        )
                    )
            else:
                block_summary = (data.get("block") or "").strip()
                if block_summary:
                    for b_name in [s.strip() for s in block_summary.split(",") if s.strip()]:
                        app_blocks.append(
                            CandidateApplicationBlock(
                                id=uuid.uuid4(),
                                application_id=app_id,
                                block_id=None,
                                district_id=None,
                                block_name=b_name,
                                district_name=None,
                            )
                        )

            raw_email = _clean_str(data.get("email"))
            raw_pan = _clean_str(data.get("pan_number"))
            raw_ifsc = _clean_str(data.get("ifsc_code"))

            application = CandidateApplication(
                id=app_id,
                application_number=app_number,
                user_id=user_id,
                hero_category=_clean_str(data.get("hero_category")) or "Hero 1",
                role_applied=_clean_str(data.get("role_applied")) or "",
                full_name=_clean_str(data.get("full_name")),
                mobile_number=_clean_str(data.get("mobile_number")),
                email=raw_email.lower() if raw_email else None,
                aadhaar_number=_clean_str(data.get("aadhaar_number")),
                pan_number=raw_pan.upper() if raw_pan else None,
                current_address_line1=_clean_str(data.get("current_address_line1")),
                current_address_line2=_clean_str(data.get("current_address_line2")),
                current_city=_clean_str(data.get("current_city")),
                current_state=_clean_str(data.get("current_state")),
                current_pincode=_clean_str(data.get("current_pincode")),
                current_country=_clean_str(data.get("current_country")) or "India",
                is_permanent_same=is_same,
                permanent_address_line1=_clean_str(perm_line1),
                permanent_address_line2=_clean_str(perm_line2),
                permanent_city=_clean_str(perm_city),
                permanent_state=_clean_str(perm_state),
                permanent_pincode=_clean_str(perm_pincode),
                permanent_country=_clean_str(perm_country) or "India",
                account_holder_name=_clean_str(data.get("account_holder_name")),
                bank_name=_clean_str(data.get("bank_name")),
                account_number=_clean_str(data.get("account_number")),
                ifsc_code=raw_ifsc.upper() if raw_ifsc else None,
                branch_name=_clean_str(data.get("branch_name")),
                circle=_clean_str(data.get("circle")),
                district=_clean_str(district_summary),
                block=_clean_str(block_summary),
                current_salary=_clean_decimal(data.get("current_salary")),
                asking_salary=_clean_decimal(data.get("asking_salary")),
                negotiated_salary=_clean_decimal(data.get("negotiated_salary")),
                status=APPLICATION_STATUS_PENDING,
            )

            # Attach child collections
            application.selected_districts = app_districts
            application.selected_blocks = app_blocks

            # Associate staged documents with this application
            for doc in staged_docs:
                doc.application_id = app_id
            application.documents = staged_docs

            # Automatically create verification checklist items in batch
            checklist_items = CandidateService.initialize_verification_checklist(
                application, staged_docs, is_new=True
            )
            application.verification_items = checklist_items

            # Record audit event
            audit = AuditLog(
                user_id=user_id,
                action="CANDIDATE_APPLICATION_SUBMITTED",
                resource="CandidateApplication",
                resource_id=str(app_id),
                ip_address=ip_address,
                user_agent=user_agent,
                details={
                    "application_number": app_number,
                    "hero_category": application.hero_category,
                    "role_applied": application.role_applied,
                    "document_count": len(staged_docs),
                },
            )

            # Persist all objects in a single batch without intermediate flushes
            db.session.add(application)
            db.session.add_all(app_districts)
            db.session.add_all(app_blocks)
            db.session.add_all(checklist_items)
            db.session.add(audit)

            # Pre-dump response payload before transaction commit so no expired-attribute queries are fired
            from app.modules.candidates.routes import _response_schema
            application._cached_dump = _response_schema.dump(application)

        return application

    @staticmethod
    def update_application(
        application: CandidateApplication,
        data: Dict[str, Any],
        user: Any,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> CandidateApplication:
        """Update an existing candidate application, preserving existing values for omitted fields."""
        with atomic():
            field_keys = [
                "hero_category", "role_applied", "full_name", "mobile_number", "email",
                "aadhaar_number", "pan_number", "current_address_line1", "current_address_line2",
                "current_city", "current_state", "current_pincode", "current_country",
                "permanent_address_line1", "permanent_address_line2", "permanent_city",
                "permanent_state", "permanent_pincode", "permanent_country",
                "account_holder_name", "bank_name", "account_number", "ifsc_code",
                "branch_name", "circle", "current_salary", "asking_salary", "negotiated_salary",
            ]
            for key in field_keys:
                if key in data:
                    val = data[key]
                    if key in ("current_salary", "asking_salary", "negotiated_salary"):
                        setattr(application, key, _clean_decimal(val))
                    elif key in ("email",):
                        cleaned = _clean_str(val)
                        setattr(application, key, cleaned.lower() if cleaned else None)
                    elif key in ("pan_number", "ifsc_code"):
                        cleaned = _clean_str(val)
                        setattr(application, key, cleaned.upper() if cleaned else None)
                    else:
                        setattr(application, key, _clean_str(val))

            if "is_permanent_same" in data:
                application.is_permanent_same = bool(data["is_permanent_same"])
                if application.is_permanent_same:
                    application.permanent_address_line1 = application.current_address_line1
                    application.permanent_address_line2 = application.current_address_line2
                    application.permanent_city = application.current_city
                    application.permanent_state = application.current_state
                    application.permanent_pincode = application.current_pincode
                    application.permanent_country = application.current_country or "India"

            # Update districts / blocks if supplied
            if "district_ids" in data or "district" in data:
                district_ids = data.get("district_ids") or []
                if district_ids:
                    dist_models = list(
                        db.session.execute(
                            select(LocationDistrict).where(LocationDistrict.id.in_(district_ids))
                        ).scalars().all()
                    )
                    application.district = ", ".join(d.name for d in dist_models)
                    db.session.execute(
                        CandidateApplicationDistrict.__table__.delete().where(
                            CandidateApplicationDistrict.application_id == application.id
                        )
                    )
                    for d in dist_models:
                        db.session.add(
                            CandidateApplicationDistrict(
                                id=uuid.uuid4(),
                                application_id=application.id,
                                district_id=d.id,
                                district_name=d.name,
                            )
                        )
                elif "district" in data:
                    application.district = _clean_str(data["district"])

            if "block_ids" in data or "block" in data:
                block_ids = data.get("block_ids") or []
                if block_ids:
                    blk_models = list(
                        db.session.execute(
                            select(LocationBlock).where(LocationBlock.id.in_(block_ids))
                        ).scalars().all()
                    )
                    application.block = ", ".join(b.name for b in blk_models)
                    db.session.execute(
                        CandidateApplicationBlock.__table__.delete().where(
                            CandidateApplicationBlock.application_id == application.id
                        )
                    )
                    for b in blk_models:
                        db.session.add(
                            CandidateApplicationBlock(
                                id=uuid.uuid4(),
                                application_id=application.id,
                                block_id=b.id,
                                district_id=b.district_id,
                                block_name=b.name,
                                district_name=b.district.name if b.district else None,
                            )
                        )
                elif "block" in data:
                    application.block = _clean_str(data["block"])

            # Link any newly staged documents for this user
            staged_docs = list(
                db.session.execute(
                    select(CandidateDocument)
                    .where(CandidateDocument.user_id == user.id)
                    .where(CandidateDocument.application_id.is_(None))
                ).scalars().all()
            )
            for doc in staged_docs:
                doc.application_id = application.id

            CandidateService.initialize_verification_checklist(application)

            audit = AuditLog(
                user_id=user.id,
                action="CANDIDATE_APPLICATION_UPDATED",
                resource="CandidateApplication",
                resource_id=str(application.id),
                ip_address=ip_address,
                user_agent=user_agent,
                details={
                    "application_number": application.application_number,
                    "updated_fields": list(data.keys()),
                },
            )
            db.session.add(audit)
            db.session.commit()

        return application

    @staticmethod
    def initialize_verification_checklist(
        application: CandidateApplication,
        documents: Optional[List[CandidateDocument]] = None,
        is_new: bool = False,
    ) -> List[CandidateVerificationItem]:
        """Generate and persist all verification checklist items for an application."""
        if documents is None:
            documents = list(
                db.session.execute(
                    select(CandidateDocument).where(CandidateDocument.application_id == application.id)
                ).scalars().all()
            )

        if is_new:
            existing_items = {}
        else:
            existing_items = {
                item.item_key: item
                for item in db.session.execute(
                    select(CandidateVerificationItem).where(
                        CandidateVerificationItem.application_id == application.id
                    )
                ).scalars().all()
            }

        # Item definitions: (key, label, category, is_mandatory)
        base_items = [
            ("personal_info", "Personal Information", "personal", True),
            ("contact_info", "Contact Information", "personal", True),
            ("current_address", "Current Address", "address", True),
            ("permanent_address", "Permanent Address", "address", True),
            ("location_allocation", "Circle, District & Block", "location", True),
            ("bank_details", "Bank Account Details", "bank", True),
            ("current_salary", "Current Salary", "salary", True),
            ("asking_salary", "Asking Salary", "salary", True),
        ]

        if application.negotiated_salary is not None:
            base_items.append(("negotiated_salary", "Negotiated Salary", "salary", True))

        created_items: List[CandidateVerificationItem] = []

        # Create details checklist items
        for key, label, category, mandatory in base_items:
            if key not in existing_items:
                item = CandidateVerificationItem(
                    id=uuid.uuid4(),
                    application_id=application.id,
                    item_key=key,
                    item_label=label,
                    item_category=category,
                    is_mandatory=mandatory,
                    status=VERIFICATION_STATUS_PENDING,
                )
                if not is_new:
                    db.session.add(item)
                created_items.append(item)

        # Create document checklist items based on uploaded documents
        doc_map = {doc.category: doc for doc in documents}

        doc_defs = [
            ("doc_aadhaar", "Aadhaar Card", "aadhaar_card", True),
            ("doc_pan", "PAN Card", "pan_card", True),
            ("doc_bank_passbook", "Bank Passbook", "bank_passbook", False),
            ("doc_cancelled_cheque", "Cancelled Cheque", "cancelled_cheque", False),
            ("doc_marksheet_10th", "10th Marksheet", "marksheet_10th", False),
            ("doc_marksheet_12th", "12th Marksheet", "marksheet_12th", False),
            ("doc_previous_employment", "Previous Employment Records", "previous_employment", False),
        ]

        for key, label, category, mandatory in doc_defs:
            if category in doc_map:
                linked_doc = doc_map[category]
                if key not in existing_items:
                    item = CandidateVerificationItem(
                        id=uuid.uuid4(),
                        application_id=application.id,
                        document_id=linked_doc.id,
                        item_key=key,
                        item_label=label,
                        item_category="document",
                        is_mandatory=mandatory,
                        status=VERIFICATION_STATUS_PENDING,
                    )
                    if not is_new:
                        db.session.add(item)
                    created_items.append(item)
                    existing_items[key] = item
                else:
                    # Sync document_id if missing or updated
                    existing_item = existing_items[key]
                    if existing_item.document_id != linked_doc.id:
                        existing_item.document_id = linked_doc.id

        if not is_new and created_items:
            db.session.commit()
        return created_items

    @staticmethod
    def recalculate_application_status(application: CandidateApplication) -> str:
        """Calculate and update the overall application status based on verification rules."""
        items = list(
            db.session.execute(
                select(CandidateVerificationItem).where(
                    CandidateVerificationItem.application_id == application.id
                )
            ).scalars().all()
        )

        item_status_map = {item.item_key: item.status for item in items}

        # Check mandatory detail items
        mandatory_detail_keys = [
            "personal_info",
            "contact_info",
            "current_address",
            "permanent_address",
            "location_allocation",
            "bank_details",
            "current_salary",
            "asking_salary",
        ]
        if "negotiated_salary" in item_status_map:
            mandatory_detail_keys.append("negotiated_salary")

        details_complete = all(
            item_status_map.get(k) == VERIFICATION_STATUS_DONE for k in mandatory_detail_keys
        )

        # Check mandatory documents
        aadhaar_done = item_status_map.get("doc_aadhaar") == VERIFICATION_STATUS_DONE
        pan_done = item_status_map.get("doc_pan") == VERIFICATION_STATUS_DONE

        # Bank document alternative rule: either Bank Passbook OR Cancelled Cheque satisfies the bank doc requirement
        bank_doc_done = (
            item_status_map.get("doc_bank_passbook") == VERIFICATION_STATUS_DONE
            or item_status_map.get("doc_cancelled_cheque") == VERIFICATION_STATUS_DONE
        )

        all_mandatory_done = (
            details_complete and aadhaar_done and pan_done and bank_doc_done
        )

        any_done = any(item.status == VERIFICATION_STATUS_DONE for item in items)

        if application.status == APPLICATION_STATUS_APPROVED:
            return APPLICATION_STATUS_APPROVED

        if application.status == APPLICATION_STATUS_REJECTED:
            return APPLICATION_STATUS_REJECTED

        if all_mandatory_done:
            new_status = APPLICATION_STATUS_COMPLETE
        elif any_done:
            new_status = APPLICATION_STATUS_IN_PROGRESS
        else:
            new_status = APPLICATION_STATUS_PENDING

        application.status = new_status
        return new_status

    @staticmethod
    def _find_verification_item(
        application: CandidateApplication,
        identifier: str,
    ) -> Optional[CandidateVerificationItem]:
        """Find a verification item by item_key, document_id (UUID), item UUID, or category."""
        if not identifier:
            return None

        clean_id = str(identifier).strip()

        # 1. Direct item_key match
        item = db.session.execute(
            select(CandidateVerificationItem)
            .where(CandidateVerificationItem.application_id == application.id)
            .where(CandidateVerificationItem.item_key == clean_id)
        ).scalar_one_or_none()
        if item:
            return item

        # 2. Check if identifier is a UUID (document_id or item id)
        try:
            ident_uuid = uuid.UUID(clean_id)
            # Check by document_id
            item = db.session.execute(
                select(CandidateVerificationItem)
                .where(CandidateVerificationItem.application_id == application.id)
                .where(CandidateVerificationItem.document_id == ident_uuid)
            ).scalar_one_or_none()
            if item:
                return item
            # Check by item primary key id
            item = db.session.execute(
                select(CandidateVerificationItem)
                .where(CandidateVerificationItem.application_id == application.id)
                .where(CandidateVerificationItem.id == ident_uuid)
            ).scalar_one_or_none()
            if item:
                return item
        except (ValueError, TypeError):
            pass

        # 3. Category mapping to item_key
        cat_to_key = {
            "aadhaar_card": "doc_aadhaar",
            "pan_card": "doc_pan",
            "bank_passbook": "doc_bank_passbook",
            "cancelled_cheque": "doc_cancelled_cheque",
            "marksheet_10th": "doc_marksheet_10th",
            "marksheet_12th": "doc_marksheet_12th",
            "previous_employment": "doc_previous_employment",
        }
        lower_id = clean_id.lower()
        if lower_id in cat_to_key:
            mapped_key = cat_to_key[lower_id]
            item = db.session.execute(
                select(CandidateVerificationItem)
                .where(CandidateVerificationItem.application_id == application.id)
                .where(CandidateVerificationItem.item_key == mapped_key)
            ).scalar_one_or_none()
            if item:
                return item

        # 4. If identifier had "doc_" prefix stripped or added
        if not lower_id.startswith("doc_"):
            candidate_key = f"doc_{lower_id}"
            item = db.session.execute(
                select(CandidateVerificationItem)
                .where(CandidateVerificationItem.application_id == application.id)
                .where(CandidateVerificationItem.item_key == candidate_key)
            ).scalar_one_or_none()
            if item:
                return item

        return None

    @staticmethod
    def mark_verification_item(
        application_id: uuid.UUID,
        item_key: str,
        verifier_user: Any,
        remarks: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> tuple[CandidateVerificationItem, CandidateApplication]:
        """Mark an individual verification item as DONE with audit trail."""
        if not AuthorizationEvaluator.has_required_permission(verifier_user, "documents:verify"):
            raise ForbiddenError("Missing required permission: 'documents:verify'.")

        application = db.session.get(CandidateApplication, application_id)
        if not application:
            raise NotFoundError("Application record not found.")

        # Ensure checklist exists (in case older record)
        CandidateService.initialize_verification_checklist(application)

        item = CandidateService._find_verification_item(application, item_key)
        if not item:
            raise NotFoundError(f"Verification item '{item_key}' not found.")

        # If document item, verify that file exists, belongs to application, and is valid
        if item.item_key.startswith("doc_") or item.item_category == "document":
            cat_map = {
                "doc_aadhaar": "aadhaar_card",
                "doc_pan": "pan_card",
                "doc_bank_passbook": "bank_passbook",
                "doc_cancelled_cheque": "cancelled_cheque",
                "doc_marksheet_10th": "marksheet_10th",
                "doc_marksheet_12th": "marksheet_12th",
                "doc_previous_employment": "previous_employment",
            }
            target_cat = cat_map.get(item.item_key)

            # Auto-link document_id from application documents if missing or unlinked
            if not item.document_id and target_cat:
                matching_doc = next(
                    (d for d in application.documents if d.category == target_cat),
                    None
                )
                if matching_doc:
                    item.document_id = matching_doc.id

            if not item.document_id:
                raise ValidationError(f"Cannot verify document: no {item.item_label} file uploaded for this candidate application.")

            doc = db.session.get(CandidateDocument, item.document_id)
            if not doc:
                raise ValidationError("Cannot verify document: associated document record was not found.")

            # Security validation: document must belong to this application/user
            if doc.application_id is not None and doc.application_id != application.id:
                raise ValidationError("Security violation: document does not belong to this candidate application.")
            if doc.user_id != application.user_id:
                raise ValidationError("Security violation: document user does not match application candidate.")

            resolved_path = resolve_document_file_path(doc)
            if not resolved_path:
                raise ValidationError(f"Cannot verify document: '{doc.original_filename}' file is missing or not found on storage.")

            if doc.file_path != resolved_path:
                doc.file_path = resolved_path
        else:
            # Submitted data checklist item: validate that the required candidate fields are present
            if item.item_key == "personal_info":
                if not (application.full_name and (application.aadhaar_number or application.aadhaar_number_masked) and (application.pan_number or application.pan_number_masked)):
                    raise ValidationError("Cannot mark Personal Information as Done: candidate identity fields are incomplete.")
            elif item.item_key == "contact_info":
                if not (application.mobile_number and application.email):
                    raise ValidationError("Cannot mark Contact Information as Done: mobile number or email is missing.")
            elif item.item_key == "current_address":
                if not (application.current_address_line1 and application.current_city and application.current_state and application.current_pincode):
                    raise ValidationError("Cannot mark Current Address as Done: current address fields are incomplete.")
            elif item.item_key == "permanent_address":
                if not (application.is_permanent_same or (application.permanent_address_line1 and application.permanent_city and application.permanent_state)):
                    raise ValidationError("Cannot mark Permanent Address as Done: permanent address fields are incomplete.")
            elif item.item_key == "location_allocation":
                if not (application.circle and application.district):
                    raise ValidationError("Cannot mark Location Allocation as Done: circle or district is missing.")
            elif item.item_key == "bank_details":
                if not (application.bank_name and application.account_number and application.ifsc_code):
                    raise ValidationError("Cannot mark Bank Details as Done: bank account details are incomplete.")
            elif item.item_key == "current_salary":
                if application.current_salary is None or application.current_salary < 0:
                    raise ValidationError("Cannot mark Current Salary as Done: salary value is invalid.")
            elif item.item_key == "asking_salary":
                if application.asking_salary is None or application.asking_salary < 0:
                    raise ValidationError("Cannot mark Asking Salary as Done: asking salary value is invalid.")

        with atomic():
            item.status = VERIFICATION_STATUS_DONE
            item.verified_by_id = verifier_user.id
            item.verified_at = datetime.now(timezone.utc)
            if remarks is not None:
                item.remarks = remarks.strip() if remarks else None

            db.session.flush()
            new_app_status = CandidateService.recalculate_application_status(application)

            audit = AuditLog(
                user_id=verifier_user.id,
                action="CANDIDATE_VERIFICATION_ITEM_DONE",
                resource="CandidateVerificationItem",
                resource_id=str(item.id),
                ip_address=ip_address,
                user_agent=user_agent,
                details={
                    "application_number": application.application_number,
                    "item_key": item.item_key,
                    "item_label": item.item_label,
                    "new_application_status": new_app_status,
                },
            )
            db.session.add(audit)

        return item, application

    @staticmethod
    def reset_verification_item(
        application_id: uuid.UUID,
        item_key: str,
        verifier_user: Any,
        remarks: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> tuple[CandidateVerificationItem, CandidateApplication]:
        """Reset an individual verification item to PENDING with audit trail."""
        if not AuthorizationEvaluator.has_required_permission(verifier_user, "documents:verify"):
            raise ForbiddenError("Missing required permission: 'documents:verify'.")

        application = db.session.get(CandidateApplication, application_id)
        if not application:
            raise NotFoundError("Application record not found.")

        item = CandidateService._find_verification_item(application, item_key)
        if not item:
            raise NotFoundError(f"Verification item '{item_key}' not found.")

        with atomic():
            item.status = VERIFICATION_STATUS_PENDING
            item.verified_by_id = None
            item.verified_at = None
            if remarks is not None:
                item.remarks = remarks.strip() if remarks else None

            db.session.flush()
            new_app_status = CandidateService.recalculate_application_status(application)

            audit = AuditLog(
                user_id=verifier_user.id,
                action="CANDIDATE_VERIFICATION_ITEM_RESET",
                resource="CandidateVerificationItem",
                resource_id=str(item.id),
                ip_address=ip_address,
                user_agent=user_agent,
                details={
                    "application_number": application.application_number,
                    "item_key": item.item_key,
                    "item_label": item.item_label,
                    "new_application_status": new_app_status,
                },
            )
            db.session.add(audit)

        return item, application

    @staticmethod
    def bulk_mark_verification_items(
        application_id: uuid.UUID,
        verifier_user: Any,
        only_documents: bool = False,
        item_keys: Optional[list[str]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> tuple[CandidateApplication, list[CandidateVerificationItem], list[dict[str, str]]]:
        """Mark eligible pending verification items as DONE with audit trail.
        Supports both uploaded documents and submitted candidate data.
        """
        if not (
            AuthorizationEvaluator.has_required_permission(verifier_user, "documents:bulk_verify")
            or AuthorizationEvaluator.has_required_permission(verifier_user, "documents:verify")
        ):
            raise ForbiddenError("Missing required permission: 'documents:bulk_verify' or 'documents:verify'.")

        application = db.session.get(CandidateApplication, application_id)
        if not application:
            raise NotFoundError("Application record not found.")

        CandidateService.initialize_verification_checklist(application)

        items = list(
            db.session.execute(
                select(CandidateVerificationItem).where(
                    CandidateVerificationItem.application_id == application.id
                )
            ).scalars().all()
        )

        cat_map = {
            "doc_aadhaar": "aadhaar_card",
            "doc_pan": "pan_card",
            "doc_bank_passbook": "bank_passbook",
            "doc_cancelled_cheque": "cancelled_cheque",
            "doc_marksheet_10th": "marksheet_10th",
            "doc_marksheet_12th": "marksheet_12th",
            "doc_previous_employment": "previous_employment",
        }

        eligible_items: list[CandidateVerificationItem] = []
        ineligible_items: list[dict[str, str]] = []

        now = datetime.now(timezone.utc)
        selected_set = set(item_keys) if item_keys else None

        for item in items:
            # If specific keys provided, filter strictly to them
            if selected_set is not None and item.item_key not in selected_set:
                continue

            # If already done, skip
            if item.status == VERIFICATION_STATUS_DONE:
                continue

            is_doc_item = item.item_key.startswith("doc_") or item.item_category == "document"

            # If only_documents is True, ignore non-document checklist items completely
            if only_documents and not is_doc_item:
                continue

            if is_doc_item:
                # Auto-link document_id from application documents if missing
                if not item.document_id:
                    target_cat = cat_map.get(item.item_key)
                    matching_doc = next(
                        (d for d in application.documents if d.category == target_cat),
                        None
                    )
                    if matching_doc:
                        item.document_id = matching_doc.id

                # Must have document_id and valid file on storage
                if not item.document_id:
                    ineligible_items.append({
                        "item_key": item.item_key,
                        "item_label": item.item_label,
                        "reason": "Missing document upload",
                    })
                    continue

                doc = db.session.get(CandidateDocument, item.document_id)
                if not doc:
                    ineligible_items.append({
                        "item_key": item.item_key,
                        "item_label": item.item_label,
                        "reason": "Document record not found",
                    })
                    continue

                # Security check
                if doc.application_id is not None and doc.application_id != application.id:
                    ineligible_items.append({
                        "item_key": item.item_key,
                        "item_label": item.item_label,
                        "reason": "Document does not belong to this application",
                    })
                    continue
                if doc.user_id != application.user_id:
                    ineligible_items.append({
                        "item_key": item.item_key,
                        "item_label": item.item_label,
                        "reason": "Document user does not match application candidate",
                    })
                    continue

                resolved_path = resolve_document_file_path(doc)
                if not resolved_path:
                    ineligible_items.append({
                        "item_key": item.item_key,
                        "item_label": item.item_label,
                        "reason": f"File '{doc.original_filename}' is missing on storage",
                    })
                    continue

                if doc.file_path != resolved_path:
                    doc.file_path = resolved_path
            else:
                # Detail item validation: check that required fields exist
                if item.item_key == "personal_info":
                    if not (application.full_name and (application.aadhaar_number or application.aadhaar_number_masked) and (application.pan_number or application.pan_number_masked)):
                        ineligible_items.append({"item_key": item.item_key, "item_label": item.item_label, "reason": "Candidate identity details are incomplete"})
                        continue
                elif item.item_key == "contact_info":
                    if not (application.mobile_number and application.email):
                        ineligible_items.append({"item_key": item.item_key, "item_label": item.item_label, "reason": "Mobile or email is missing"})
                        continue
                elif item.item_key == "current_address":
                    if not (application.current_address_line1 and application.current_city and application.current_state and application.current_pincode):
                        ineligible_items.append({"item_key": item.item_key, "item_label": item.item_label, "reason": "Current address is incomplete"})
                        continue
                elif item.item_key == "permanent_address":
                    if not (application.is_permanent_same or (application.permanent_address_line1 and application.permanent_city and application.permanent_state)):
                        ineligible_items.append({"item_key": item.item_key, "item_label": item.item_label, "reason": "Permanent address is incomplete"})
                        continue
                elif item.item_key == "location_allocation":
                    if not (application.circle and application.district):
                        ineligible_items.append({"item_key": item.item_key, "item_label": item.item_label, "reason": "Location circle or district is missing"})
                        continue
                elif item.item_key == "bank_details":
                    if not (application.bank_name and application.account_number and application.ifsc_code):
                        ineligible_items.append({"item_key": item.item_key, "item_label": item.item_label, "reason": "Bank account details are incomplete"})
                        continue

            eligible_items.append(item)

        if eligible_items:
            with atomic():
                for item in eligible_items:
                    item.status = VERIFICATION_STATUS_DONE
                    item.verified_by_id = verifier_user.id
                    item.verified_at = now

                db.session.flush()
                new_app_status = CandidateService.recalculate_application_status(application)

                audit_action = (
                    "CANDIDATE_DOCUMENTS_BULK_VERIFIED"
                    if only_documents
                    else "CANDIDATE_VERIFICATION_BULK_DONE"
                )
                audit = AuditLog(
                    user_id=verifier_user.id,
                    action=audit_action,
                    resource="CandidateApplication",
                    resource_id=str(application.id),
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details={
                        "application_number": application.application_number,
                        "eligible_count": len(eligible_items),
                        "ineligible_count": len(ineligible_items),
                        "updated_item_keys": [i.item_key for i in eligible_items],
                        "ineligible_details": ineligible_items,
                        "new_application_status": new_app_status,
                        "only_documents": only_documents,
                    },
                )
                db.session.add(audit)

        return application, eligible_items, ineligible_items

    @staticmethod
    def bulk_approve_candidates(
        application_ids: list[str],
        reviewer_user: Any,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> dict[str, Any]:
        """Bulk approve eligible candidate applications.
        Verifies authorization, record existence, mandatory checks, and records audit trail.
        """
        if not AuthorizationEvaluator.has_required_permission(reviewer_user, "candidates:approve"):
            raise ForbiddenError("Missing required permission: 'candidates:approve'.")

        successful_apps: list[CandidateApplication] = []
        failed_items: list[dict[str, Any]] = []

        now = datetime.now(timezone.utc)

        for app_id_str in application_ids:
            try:
                try:
                    app_uuid = uuid.UUID(str(app_id_str))
                except (ValueError, TypeError):
                    failed_items.append({
                        "id": str(app_id_str),
                        "application_number": "N/A",
                        "reason": "Invalid application ID format",
                    })
                    continue

                application = db.session.get(CandidateApplication, app_uuid)
                if not application:
                    failed_items.append({
                        "id": str(app_id_str),
                        "application_number": "N/A",
                        "reason": "Application record not found",
                    })
                    continue

                if application.status == APPLICATION_STATUS_APPROVED:
                    # Idempotent: already approved
                    successful_apps.append(application)
                    continue

                if application.status == APPLICATION_STATUS_REJECTED:
                    failed_items.append({
                        "id": str(application.id),
                        "application_number": application.application_number,
                        "reason": "Cannot approve an already rejected application",
                    })
                    continue

                # Ensure verification checklist exists
                CandidateService.initialize_verification_checklist(application)

                # Execute individual atomic approval for safety and transaction isolation
                with atomic():
                    application.status = APPLICATION_STATUS_APPROVED
                    application.reviewed_by_id = reviewer_user.id
                    application.reviewed_at = now
                    application.rejection_reason = None

                    audit = AuditLog(
                        user_id=reviewer_user.id,
                        action="CANDIDATE_BULK_APPROVED",
                        resource="CandidateApplication",
                        resource_id=str(application.id),
                        ip_address=ip_address,
                        user_agent=user_agent,
                        details={
                            "application_number": application.application_number,
                            "decision": "APPROVED",
                            "bulk": True,
                        },
                    )
                    db.session.add(audit)

                successful_apps.append(application)

            except Exception as e:
                failed_items.append({
                    "id": str(app_id_str),
                    "application_number": getattr(application, "application_number", "N/A") if 'application' in locals() and application else "N/A",
                    "reason": str(e),
                })

        return {
            "total_requested": len(application_ids),
            "approved_count": len(successful_apps),
            "failed_count": len(failed_items),
            "successful_ids": [str(a.id) for a in successful_apps],
            "failed_items": failed_items,
        }

    @staticmethod
    def bulk_reject_candidates(
        application_ids: list[str],
        reviewer_user: Any,
        reason: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> dict[str, Any]:
        """Bulk reject candidate applications with mandatory reason."""
        if not AuthorizationEvaluator.has_required_permission(reviewer_user, "candidates:reject"):
            raise ForbiddenError("Missing required permission: 'candidates:reject'.")

        clean_reason = (reason or "").strip()
        if not clean_reason:
            raise ValidationError("A valid non-empty rejection reason must be provided.")

        successful_apps: list[CandidateApplication] = []
        failed_items: list[dict[str, Any]] = []

        now = datetime.now(timezone.utc)

        for app_id_str in application_ids:
            try:
                try:
                    app_uuid = uuid.UUID(str(app_id_str))
                except (ValueError, TypeError):
                    failed_items.append({
                        "id": str(app_id_str),
                        "application_number": "N/A",
                        "reason": "Invalid application ID format",
                    })
                    continue

                application = db.session.get(CandidateApplication, app_uuid)
                if not application:
                    failed_items.append({
                        "id": str(app_id_str),
                        "application_number": "N/A",
                        "reason": "Application record not found",
                    })
                    continue

                if application.status == APPLICATION_STATUS_APPROVED:
                    failed_items.append({
                        "id": str(application.id),
                        "application_number": application.application_number,
                        "reason": "Cannot reject an already Approved application",
                    })
                    continue

                if application.status == APPLICATION_STATUS_REJECTED:
                    # Idempotent skip: already rejected
                    successful_apps.append(application)
                    continue

                with atomic():
                    application.status = APPLICATION_STATUS_REJECTED
                    application.reviewed_by_id = reviewer_user.id
                    application.reviewed_at = now
                    application.rejection_reason = clean_reason

                    audit = AuditLog(
                        user_id=reviewer_user.id,
                        action="CANDIDATE_BULK_REJECTED",
                        resource="CandidateApplication",
                        resource_id=str(application.id),
                        ip_address=ip_address,
                        user_agent=user_agent,
                        details={
                            "application_number": application.application_number,
                            "decision": "REJECTED",
                            "reason": clean_reason,
                            "bulk": True,
                        },
                    )
                    db.session.add(audit)

                successful_apps.append(application)

            except Exception as e:
                failed_items.append({
                    "id": str(app_id_str),
                    "application_number": getattr(application, "application_number", "N/A") if 'application' in locals() and application else "N/A",
                    "reason": str(e),
                })

        return {
            "total_requested": len(application_ids),
            "rejected_count": len(successful_apps),
            "failed_count": len(failed_items),
            "successful_ids": [str(a.id) for a in successful_apps],
            "failed_items": failed_items,
        }

    @staticmethod
    def approve_candidate(
        application_id: uuid.UUID,
        reviewer_user: Any,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> CandidateApplication:
        """Approve candidate application if all verification items are complete."""
        if not AuthorizationEvaluator.has_required_permission(reviewer_user, "candidates:approve"):
            raise ForbiddenError("Missing required permission: 'candidates:approve'.")

        application = db.session.get(CandidateApplication, application_id)
        if not application:
            raise NotFoundError("Application record not found.")

        if application.status == APPLICATION_STATUS_REJECTED:
            raise ValidationError("Cannot approve an already rejected application.")

        # Ensure checklist is loaded
        CandidateService.initialize_verification_checklist(application)

        with atomic():
            application.status = APPLICATION_STATUS_APPROVED
            application.reviewed_by_id = reviewer_user.id
            application.reviewed_at = datetime.now(timezone.utc)
            application.rejection_reason = None

            audit = AuditLog(
                user_id=reviewer_user.id,
                action="CANDIDATE_APPLICATION_APPROVED",
                resource="CandidateApplication",
                resource_id=str(application.id),
                ip_address=ip_address,
                user_agent=user_agent,
                details={
                    "application_number": application.application_number,
                    "reviewer_name": reviewer_user.full_name or reviewer_user.email,
                },
            )
            db.session.add(audit)

        return application

    @staticmethod
    def reject_candidate(
        application_id: uuid.UUID,
        reviewer_user: Any,
        reason: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> CandidateApplication:
        """Reject candidate application with a mandatory reason."""
        if not AuthorizationEvaluator.has_required_permission(reviewer_user, "candidates:reject"):
            raise ForbiddenError("Missing required permission: 'candidates:reject'.")

        if not reason or not reason.strip():
            raise ValidationError("A non-empty rejection reason is required.")

        application = db.session.get(CandidateApplication, application_id)
        if not application:
            raise NotFoundError("Application record not found.")

        with atomic():
            application.status = APPLICATION_STATUS_REJECTED
            application.rejection_reason = reason.strip()
            application.reviewed_by_id = reviewer_user.id
            application.reviewed_at = datetime.now(timezone.utc)

            audit = AuditLog(
                user_id=reviewer_user.id,
                action="CANDIDATE_APPLICATION_REJECTED",
                resource="CandidateApplication",
                resource_id=str(application.id),
                ip_address=ip_address,
                user_agent=user_agent,
                details={
                    "application_number": application.application_number,
                    "reviewer_name": reviewer_user.full_name or reviewer_user.email,
                    "rejection_reason": reason.strip(),
                },
            )
            db.session.add(audit)

        return application
