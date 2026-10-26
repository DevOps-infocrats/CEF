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
@require_auth
def get_template_metadata(template_type: str):
    """Get active master template metadata, version, and placeholder mappings."""
    if template_type not in VALID_TEMPLATE_TYPES:
        raise ValidationError(f"Invalid template type: '{template_type}'. Expected 'letter_of_intent' or 'offer_letter'.")

    tmpl = LetterTemplateService.get_active_template(template_type)
    file_exists = bool(tmpl.storage_path and os.path.exists(tmpl.storage_path))
    file_size = os.path.getsize(tmpl.storage_path) if file_exists else 0

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
    file_exists = bool(new_tmpl.storage_path and os.path.exists(new_tmpl.storage_path))
    file_size = os.path.getsize(new_tmpl.storage_path) if file_exists else 0

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
@require_auth
def download_master_template(template_type: str):
    """Download the active master Word template."""
    tmpl = LetterTemplateService.get_active_template(template_type)

    if not os.path.exists(tmpl.storage_path):
        raise NotFoundError("Master template file not found on disk.")

    return send_file(
        tmpl.storage_path,
        as_attachment=True,
        download_name=tmpl.filename,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


# ==============================================================================
# CANDIDATE LETTER WORKFLOW & PREVIEW
# ==============================================================================

@letters_bp.route("/applications/<string:app_id>/letters", methods=["GET"])
@require_auth
def get_candidate_letters(app_id: str):
    """Fetch or initialize generated letter drafts for an approved candidate application."""
    user = g.current_user
    app_uuid = _resolve_uuid(app_id)

    user_roles = getattr(user, "role_names", []) or []
    can_view = (
        AuthorizationEvaluator.has_required_permission(user, "candidates:read")
        or AuthorizationEvaluator.has_required_permission(user, "documents:view")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:approve")
        or AuthorizationEvaluator.has_required_permission(user, "users:manage")
        or "admin" in user_roles
    )
    if not can_view:
        from app.modules.candidates.models import CandidateApplication
        from app.extensions import db
        app_obj = db.session.get(CandidateApplication, app_uuid)
        if not app_obj or app_obj.user_id != user.id:
            raise ForbiddenError("You are not authorized to view letters for this application.")

    letters_data = LetterGenerationService.get_or_create_candidate_letters(app_uuid, user)

    return api_response(
        data=letters_data,
        message="Candidate letters retrieved successfully.",
        status_code=200,
    )


@letters_bp.route("/applications/<string:app_id>/letters/<string:letter_type>", methods=["PATCH"])
@require_auth
def update_candidate_letter(app_id: str, letter_type: str):
    """Save edits, update placeholders, or upload revised DOCX for a candidate's letter draft."""
    user = g.current_user
    app_uuid = _resolve_uuid(app_id)

    user_roles = getattr(user, "role_names", []) or []
    can_edit = (
        AuthorizationEvaluator.has_required_permission(user, "candidates:approve")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:edit")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:write")
        or AuthorizationEvaluator.has_required_permission(user, "users:manage")
        or "admin" in user_roles
    )
    if not can_edit:
        raise ForbiddenError("Missing required permission to edit or save candidate letter drafts.")

    if letter_type not in VALID_TEMPLATE_TYPES:
        raise ValidationError(f"Invalid letter type: '{letter_type}'")

    field_values = {}
    uploaded_docx = None

    if request.is_json:
        data = request.get_json() or {}
        field_values = data.get("field_values", {})
    elif request.form:
        import json
        raw_fields = request.form.get("field_values")
        if raw_fields:
            try:
                field_values = json.loads(raw_fields)
            except Exception:
                raise ValidationError("Invalid JSON in 'field_values' form parameter.")
        if "file" in request.files:
            uploaded_docx = request.files["file"]

    updated_letter = LetterGenerationService.update_letter_draft(
        application_id=app_uuid,
        letter_type=letter_type,
        field_values=field_values,
        uploaded_docx=uploaded_docx,
        user=user,
    )

    return api_response(
        data=LetterGenerationService._serialize_letter(updated_letter),
        message=f"Candidate {letter_type} draft updated successfully.",
        status_code=200,
    )


@letters_bp.route("/applications/<string:app_id>/letters/<string:letter_type>/download", methods=["GET"])
@require_auth
def download_candidate_letter(app_id: str, letter_type: str):
    """Download candidate letter in DOCX or PDF format."""
    user = g.current_user
    app_uuid = _resolve_uuid(app_id)
    doc_format = request.args.get("format", "docx").lower()

    user_roles = getattr(user, "role_names", []) or []
    can_download = (
        AuthorizationEvaluator.has_required_permission(user, "documents:view")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:read")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:approve")
        or AuthorizationEvaluator.has_required_permission(user, "users:manage")
        or "admin" in user_roles
    )
    if not can_download:
        from app.modules.candidates.models import CandidateApplication
        from app.extensions import db
        app_obj = db.session.get(CandidateApplication, app_uuid)
        if not app_obj or app_obj.user_id != user.id:
            raise ForbiddenError("You are not authorized to download letters for this application.")

    letters_data = LetterGenerationService.get_or_create_candidate_letters(app_uuid, user)
    cand_app = letters_data["application"]

    from app.modules.letters.models import CandidateLetter
    from sqlalchemy import select
    from app.extensions import db

    letter = db.session.execute(
        select(CandidateLetter)
        .where(CandidateLetter.application_id == app_uuid)
        .where(CandidateLetter.letter_type == letter_type)
        .order_by(CandidateLetter.version.desc(), CandidateLetter.created_at.desc())
    ).scalars().first()

    if not letter:
        raise NotFoundError("Letter not found.")

    safe_name = cand_app["full_name"].replace(" ", "_")

    is_inline = request.args.get("inline", "0").lower() in ("1", "true", "yes")

    if doc_format == "pdf":
        pdf_path = LetterGenerationService.get_or_render_pdf(letter)
        if pdf_path.endswith(".pdf") and os.path.exists(pdf_path):
            return send_file(
                pdf_path,
                as_attachment=not is_inline,
                download_name=f"{letter_type}_{safe_name}.pdf",
                mimetype="application/pdf",
            )

    if not os.path.exists(letter.docx_storage_path):
        raise NotFoundError("DOCX file not found on disk.")

    return send_file(
        letter.docx_storage_path,
        as_attachment=True,
        download_name=f"{letter_type}_{safe_name}.docx",
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@letters_bp.route("/applications/<string:app_id>/letters/send", methods=["POST"])
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
