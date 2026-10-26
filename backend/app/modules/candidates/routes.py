import os
import uuid
from flask import Blueprint, request, g, send_file
from sqlalchemy import select, func
from app.extensions import db
from app.common.responses import api_response
from app.common.errors.exceptions import ForbiddenError, NotFoundError, ValidationError, ConflictError
from app.common.permissions.decorators import require_auth, require_roles
from app.common.permissions.authorization import AuthorizationEvaluator
from app.modules.auth.models import AuditLog
from app.modules.candidates.models import ApplicationRole
from app.modules.candidates.schemas import (
    CreateCandidateApplicationSchema,
    CandidateApplicationResponseSchema,
    CandidateDocumentResponseSchema,
    CandidateVerificationItemResponseSchema,
    UpdateVerificationItemSchema,
    RejectCandidateSchema,
    ApplicationRoleResponseSchema,
    CreateApplicationRoleSchema,
    UpdateApplicationRoleSchema,
)
from app.modules.candidates.services import CandidateService
from app.modules.candidates.selectors import (
    get_application_by_id,
    get_applications_by_user_id,
    list_all_applications,
    get_document_by_id,
    get_staged_documents_by_user_id,
)

candidates_bp = Blueprint("candidates", __name__, url_prefix="/api/v1/applications")

_create_schema = CreateCandidateApplicationSchema()
_response_schema = CandidateApplicationResponseSchema()
_list_schema = CandidateApplicationResponseSchema(many=True)
_doc_schema = CandidateDocumentResponseSchema()
_doc_list_schema = CandidateDocumentResponseSchema(many=True)
_verification_item_schema = CandidateVerificationItemResponseSchema()
_verification_items_schema = CandidateVerificationItemResponseSchema(many=True)
_update_item_schema = UpdateVerificationItemSchema()
_reject_schema = RejectCandidateSchema()
_role_schema = ApplicationRoleResponseSchema()
_roles_list_schema = ApplicationRoleResponseSchema(many=True)
_create_role_schema = CreateApplicationRoleSchema()
_update_role_schema = UpdateApplicationRoleSchema()


def _get_client_metadata() -> tuple[str, str]:
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "unknown")
    if "," in ip:
        ip = ip.split(",")[0].strip()
    user_agent = request.headers.get("User-Agent", "unknown")[:250]
    return ip, user_agent


# ---------------------------------------------------------
# Document Upload, Management, and Download Endpoints
# ---------------------------------------------------------

@candidates_bp.route("/documents/upload", methods=["POST"])
@require_auth
def upload_document():
    """Upload a candidate supporting document."""
    if "file" not in request.files:
        raise ValidationError("Missing 'file' field in multipart form-data.")

    file = request.files["file"]
    category = request.form.get("category", "").strip().lower()

    if not category:
        raise ValidationError("Missing 'category' field in request.")

    doc = CandidateService.save_document(
        user_id=g.current_user.id,
        category=category,
        file=file,
    )

    return api_response(
        data=_doc_schema.dump(doc),
        message="Document uploaded successfully.",
        status_code=201,
    )


@candidates_bp.route("/documents", methods=["GET"])
@require_auth
def list_staged_documents():
    """List unattached/staged documents uploaded by current user."""
    docs = get_staged_documents_by_user_id(g.current_user.id)
    return api_response(
        data=_doc_list_schema.dump(docs),
        message="Staged documents retrieved successfully.",
        status_code=200,
    )


@candidates_bp.route("/documents/<uuid:doc_id>", methods=["DELETE"])
@require_auth
def delete_document(doc_id):
    """Delete an unattached document."""
    CandidateService.delete_document(doc_id=doc_id, user_id=g.current_user.id)
    return api_response(
        data={"deleted": True},
        message="Document deleted successfully.",
        status_code=200,
    )


@candidates_bp.route("/documents/<uuid:doc_id>", methods=["GET"])
@require_auth
def download_document(doc_id):
    """Stream or download a candidate document securely."""
    doc = get_document_by_id(doc_id)
    if not doc:
        raise NotFoundError("Document not found.")

    user = g.current_user
    user_roles = user.role_names

    # Authorization: Owner or user with documents:view permission
    if doc.user_id != user.id and not AuthorizationEvaluator.has_required_permission(user, "documents:view"):
        raise ForbiddenError("You are not authorized to view this document.")

    if not os.path.exists(doc.file_path):
        raise NotFoundError("Physical document file not found on server.")

    response = send_file(
        doc.file_path,
        mimetype=doc.content_type,
        as_attachment=False,
        download_name=doc.original_filename,
        conditional=True,
        max_age=3600,
    )
    response.headers["Cache-Control"] = "private, max-age=3600"
    return response


# ---------------------------------------------------------
# Candidate Application Endpoints
# ---------------------------------------------------------

@candidates_bp.route("", methods=["POST"])
@require_auth
def submit_application():
    """Submit a new Candidate Enrollment Form application."""
    user = g.current_user
    if not (
        AuthorizationEvaluator.has_required_permission(user, "candidates:create")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:submit")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:write")
    ):
        raise ForbiddenError("Missing required permission to create or submit candidate applications.")

    payload = request.get_json(silent=True) or {}
    validated_data = _create_schema.load(payload)

    ip_address, user_agent = _get_client_metadata()

    application = CandidateService.create_application(
        user_id=user.id,
        data=validated_data,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    response_data = getattr(application, "_cached_dump", None) or _response_schema.dump(application)

    return api_response(
        data=response_data,
        message="Candidate application submitted successfully.",
        status_code=201,
    )


@candidates_bp.route("", methods=["GET"])
@require_auth
def list_applications():
    """List candidate applications. Verifiers/Admins see all; applicants see their own."""
    user = g.current_user

    # User must have permission to read candidates
    if not AuthorizationEvaluator.has_required_permission(user, "candidates:read"):
        raise ForbiddenError("Missing required permission: 'candidates:read'.")

    can_view_all = (
        AuthorizationEvaluator.has_required_permission(user, "documents:verify")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:approve")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:review")
        or AuthorizationEvaluator.has_required_permission(user, "users:manage")
        or "admin" in user.role_names
    )

    if can_view_all:
        applications = list_all_applications()
    else:
        applications = get_applications_by_user_id(user.id)

    return api_response(
        data=_list_schema.dump(applications),
        message="Applications retrieved successfully.",
        status_code=200,
    )


@candidates_bp.route("/<string:app_id>", methods=["GET"])
@require_auth
def get_application_detail(app_id: str):
    """Retrieve details of a single application with strict access control."""
    application = get_application_by_id(app_id)
    if not application:
        raise NotFoundError("Application record not found.")

    user = g.current_user

    can_view_all = (
        AuthorizationEvaluator.has_required_permission(user, "documents:verify")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:approve")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:review")
        or AuthorizationEvaluator.has_required_permission(user, "users:manage")
        or "admin" in user.role_names
    )

    # Check authorization: user must own application OR possess review permissions
    if application.user_id != user.id and not can_view_all:
        raise ForbiddenError("You are not authorized to view this application.")

    # Lazy-initialize verification items if application was created prior to verification feature
    if not application.verification_items:
        CandidateService.initialize_verification_checklist(application)

    # Allow unmasked view only if authorized HR/admin explicitly requests it
    is_verifier = can_view_all
    allow_unmasked = is_verifier and request.args.get("unmask", "").lower() == "true"

    schema = CandidateApplicationResponseSchema(context={"allow_unmasked": allow_unmasked})

    return api_response(
        data=schema.dump(application),
        message="Application details retrieved successfully.",
        status_code=200,
    )


# ---------------------------------------------------------
# Verification Workflow Endpoints
# ---------------------------------------------------------

@candidates_bp.route("/<string:app_id>/verification", methods=["GET"])
@require_auth
def get_verification_checklist(app_id: str):
    """Retrieve the verification checklist and progress for an application."""
    application = get_application_by_id(app_id)
    if not application:
        raise NotFoundError("Application record not found.")

    user = g.current_user

    can_view = (
        application.user_id == user.id
        or AuthorizationEvaluator.has_required_permission(user, "documents:verify")
        or AuthorizationEvaluator.has_required_permission(user, "candidates:read")
        or "admin" in user.role_names
    )
    if not can_view:
        raise ForbiddenError("You are not authorized to view verification status.")

    if not application.verification_items:
        CandidateService.initialize_verification_checklist(application)

    items_dump = _verification_items_schema.dump(application.verification_items)
    progress_dump = _response_schema.get_verification_progress(application)

    return api_response(
        data={
            "application_id": str(application.id),
            "application_number": application.application_number,
            "application_status": application.status,
            "verification_progress": progress_dump,
            "verification_items": items_dump,
        },
        message="Verification checklist retrieved successfully.",
        status_code=200,
    )


@candidates_bp.route("/<string:app_id>/verification/<string:item_key>/done", methods=["POST"])
@require_auth
def mark_item_done(app_id: str, item_key: str):
    """Mark an individual verification item as Done (Staff with documents:verify only)."""
    user = g.current_user

    if not AuthorizationEvaluator.has_required_permission(user, "documents:verify"):
        raise ForbiddenError("Missing required permission: 'documents:verify'.")

    application = get_application_by_id(app_id)
    if not application:
        raise NotFoundError("Application record not found.")

    payload = request.get_json(silent=True) or {}
    validated_payload = _update_item_schema.load(payload)
    remarks = validated_payload.get("remarks")

    ip_address, user_agent = _get_client_metadata()

    item, updated_app = CandidateService.mark_verification_item(
        application_id=application.id,
        item_key=item_key,
        verifier_user=user,
        remarks=remarks,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    progress_dump = _response_schema.get_verification_progress(updated_app)

    return api_response(
        data={
            "item": _verification_item_schema.dump(item),
            "application_status": updated_app.status,
            "verification_progress": progress_dump,
        },
        message=f"Verification item '{item.item_label}' marked as Done.",
        status_code=200,
    )


@candidates_bp.route("/<string:app_id>/verification/<string:item_key>/reset", methods=["POST"])
@require_auth
def reset_item_status(app_id: str, item_key: str):
    """Reset a verification item back to Pending (Staff with documents:verify only)."""
    user = g.current_user

    if not AuthorizationEvaluator.has_required_permission(user, "documents:verify"):
        raise ForbiddenError("Missing required permission: 'documents:verify'.")

    application = get_application_by_id(app_id)
    if not application:
        raise NotFoundError("Application record not found.")

    payload = request.get_json(silent=True) or {}
    validated_payload = _update_item_schema.load(payload)
    remarks = validated_payload.get("remarks")

    ip_address, user_agent = _get_client_metadata()

    item, updated_app = CandidateService.reset_verification_item(
        application_id=application.id,
        item_key=item_key,
        verifier_user=user,
        remarks=remarks,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    progress_dump = _response_schema.get_verification_progress(updated_app)

    return api_response(
        data={
            "item": _verification_item_schema.dump(item),
            "application_status": updated_app.status,
            "verification_progress": progress_dump,
        },
        message=f"Verification item '{item.item_label}' reset to Pending.",
        status_code=200,
    )


@candidates_bp.route("/<string:app_id>/verification/bulk-done", methods=["POST"])
@candidates_bp.route("/<string:app_id>/verification/bulk-mark-done", methods=["POST"])
@candidates_bp.route("/<string:app_id>/verification/bulk-documents", methods=["POST"])
@require_auth
def bulk_mark_done(app_id: str):
    """Mark eligible items (documents or submitted data) as Done (Staff with documents:bulk_verify or documents:verify)."""
    user = g.current_user

    if not (
        AuthorizationEvaluator.has_required_permission(user, "documents:bulk_verify")
        or AuthorizationEvaluator.has_required_permission(user, "documents:verify")
    ):
        raise ForbiddenError("Missing required permission: 'documents:bulk_verify' or 'documents:verify'.")

    application = get_application_by_id(app_id)
    if not application:
        raise NotFoundError("Application record not found.")

    payload = request.get_json(silent=True) or {}
    item_keys = payload.get("item_keys")
    scope = request.args.get("scope", payload.get("scope", "all" if item_keys else "documents"))
    only_documents = payload.get("only_documents", scope == "documents" and not item_keys)

    ip_address, user_agent = _get_client_metadata()

    updated_app, eligible_items, ineligible_items = CandidateService.bulk_mark_verification_items(
        application_id=application.id,
        verifier_user=user,
        only_documents=only_documents,
        item_keys=item_keys,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    progress_dump = _response_schema.get_verification_progress(updated_app)
    items_dump = _verification_items_schema.dump(updated_app.verification_items)

    unit = "uploaded documents" if only_documents else "items"
    return api_response(
        data={
            "application_status": updated_app.status,
            "verification_progress": progress_dump,
            "verification_items": items_dump,
            "marked_done_count": len(eligible_items),
            "marked_done_keys": [i.item_key for i in eligible_items],
            "ineligible_items": ineligible_items,
        },
        message=f"Bulk verification completed: {len(eligible_items)} {unit} marked as Done.",
        status_code=200,
    )


@candidates_bp.route("/bulk-approve", methods=["POST"])
@require_auth
def bulk_approve_applications():
    """Bulk approve candidate applications (Staff with candidates:approve only)."""
    user = g.current_user

    if not AuthorizationEvaluator.has_required_permission(user, "candidates:approve"):
        raise ForbiddenError("Missing required permission: 'candidates:approve'.")

    payload = request.get_json(silent=True) or {}
    app_ids = payload.get("application_ids") or []
    if not isinstance(app_ids, list) or not app_ids:
        raise ValidationError("Payload must contain a non-empty 'application_ids' list.")

    ip_address, user_agent = _get_client_metadata()

    result = CandidateService.bulk_approve_candidates(
        application_ids=app_ids,
        reviewer_user=user,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return api_response(
        data=result,
        message=f"Bulk approval processed: {result['approved_count']} approved, {result['failed_count']} failed.",
        status_code=200,
    )


@candidates_bp.route("/bulk-reject", methods=["POST"])
@require_auth
def bulk_reject_applications():
    """Bulk reject candidate applications with mandatory reason (Staff with candidates:reject only)."""
    user = g.current_user

    if not AuthorizationEvaluator.has_required_permission(user, "candidates:reject"):
        raise ForbiddenError("Missing required permission: 'candidates:reject'.")

    payload = request.get_json(silent=True) or {}
    app_ids = payload.get("application_ids") or []
    if not isinstance(app_ids, list) or not app_ids:
        raise ValidationError("Payload must contain a non-empty 'application_ids' list.")

    reason = (payload.get("reason") or "").strip()
    if not reason:
        raise ValidationError("A valid non-empty rejection reason must be provided.")

    ip_address, user_agent = _get_client_metadata()

    result = CandidateService.bulk_reject_candidates(
        application_ids=app_ids,
        reviewer_user=user,
        reason=reason,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return api_response(
        data=result,
        message=f"Bulk rejection processed: {result['rejected_count']} rejected, {result['failed_count']} failed.",
        status_code=200,
    )


@candidates_bp.route("/<string:app_id>/approve", methods=["POST"])
@require_auth
def approve_candidate(app_id: str):
    """Approve candidate application (Staff with candidates:approve only)."""
    user = g.current_user

    if not AuthorizationEvaluator.has_required_permission(user, "candidates:approve"):
        raise ForbiddenError("Missing required permission: 'candidates:approve'.")

    application = get_application_by_id(app_id)
    if not application:
        raise NotFoundError("Application record not found.")

    ip_address, user_agent = _get_client_metadata()

    updated_app = CandidateService.approve_candidate(
        application_id=application.id,
        reviewer_user=user,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return api_response(
        data=_response_schema.dump(updated_app),
        message=f"Candidate application '{updated_app.application_number}' approved successfully.",
        status_code=200,
    )


@candidates_bp.route("/<string:app_id>/reject", methods=["POST"])
@require_auth
def reject_candidate(app_id: str):
    """Reject candidate application with reason (Staff with candidates:reject only)."""
    user = g.current_user

    if not AuthorizationEvaluator.has_required_permission(user, "candidates:reject"):
        raise ForbiddenError("Missing required permission: 'candidates:reject'.")

    application = get_application_by_id(app_id)
    if not application:
        raise NotFoundError("Application record not found.")

    payload = request.get_json(silent=True) or {}
    validated_payload = _reject_schema.load(payload)
    reason = validated_payload["reason"]

    ip_address, user_agent = _get_client_metadata()

    updated_app = CandidateService.reject_candidate(
        application_id=application.id,
        reviewer_user=user,
        reason=reason,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return api_response(
        data=_response_schema.dump(updated_app),
        message=f"Candidate application '{updated_app.application_number}' has been rejected.",
        status_code=200,
    )


def _ensure_initial_roles():
    """Seed initial 3 roles if application_roles table has no records."""
    count = db.session.execute(select(func.count(ApplicationRole.id))).scalar() or 0
    if count == 0:
        initial = [
            {"name": "HDD Operate", "code": "ROLE-01", "description": "HDD directional drilling machine operator"},
            {"name": "HDD Tracker", "code": "ROLE-02", "description": "HDD tracking and walkover locator specialist"},
            {"name": "HDD Helper", "code": "ROLE-03", "description": "HDD drilling support, rig setup, and utility assistant"},
        ]
        for item in initial:
            role = ApplicationRole(
                name=item["name"],
                code=item["code"],
                description=item["description"],
                is_active=True,
            )
            db.session.add(role)
        db.session.commit()


# ---------------------------------------------------------
# Dynamic Application Roles Endpoints
# ---------------------------------------------------------

@candidates_bp.route("/roles", methods=["GET"])
def list_roles():
    """List designation roles. Returns active roles or all if requested by admin."""
    _ensure_initial_roles()
    include_all = request.args.get("all", "").lower() in ("true", "1")

    # Check if caller is admin when requesting all roles
    is_admin = False
    try:
        from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
        from app.modules.auth.models import User
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if identity:
            u_id = uuid.UUID(str(identity))
            u = db.session.get(User, u_id)
            if u and "admin" in u.role_names:
                is_admin = True
    except Exception:
        pass

    stmt = select(ApplicationRole).order_by(ApplicationRole.created_at.asc())
    if not (include_all and is_admin):
        stmt = stmt.where(ApplicationRole.is_active.is_(True))

    roles = list(db.session.execute(stmt).scalars().all())
    return api_response(
        data=_roles_list_schema.dump(roles),
        message="Roles retrieved successfully.",
        status_code=200,
    )


@candidates_bp.route("/roles", methods=["POST"])
@require_roles("admin")
def create_role():
    """Create a new designation role (Admin only)."""
    payload = request.get_json(silent=True) or {}
    validated = _create_role_schema.load(payload)
    name = validated["name"].strip()

    # Check case-insensitive duplicate
    existing = db.session.execute(
        select(ApplicationRole).where(func.lower(ApplicationRole.name) == name.lower())
    ).scalar_one_or_none()
    if existing:
        raise ConflictError(f"A role with the name '{name}' already exists.")

    role = ApplicationRole(
        name=name,
        code=validated.get("code") or f"ROLE-{uuid.uuid4().hex[:4].upper()}",
        description=validated.get("description"),
        is_active=validated.get("is_active", True),
    )
    db.session.add(role)
    db.session.commit()

    ip_address, user_agent = _get_client_metadata()
    audit = AuditLog(
        user_id=g.current_user.id,
        action="ROLE_CREATED",
        resource="ApplicationRole",
        resource_id=str(role.id),
        ip_address=ip_address,
        user_agent=user_agent,
        details={"name": role.name, "code": role.code},
    )
    db.session.add(audit)
    db.session.commit()

    return api_response(
        data=_role_schema.dump(role),
        message=f"Role '{role.name}' created successfully.",
        status_code=201,
    )


@candidates_bp.route("/roles/<uuid:role_id>", methods=["PUT"])
@require_roles("admin")
def update_role(role_id):
    """Update role name, description, code, or active status (Admin only)."""
    role = db.session.get(ApplicationRole, role_id)
    if not role:
        raise NotFoundError("Role not found.")

    payload = request.get_json(silent=True) or {}
    validated = _update_role_schema.load(payload)

    if "name" in validated and validated["name"]:
        new_name = validated["name"].strip()
        existing = db.session.execute(
            select(ApplicationRole).where(
                func.lower(ApplicationRole.name) == new_name.lower(),
                ApplicationRole.id != role.id,
            )
        ).scalar_one_or_none()
        if existing:
            raise ConflictError(f"A role with the name '{new_name}' already exists.")
        role.name = new_name

    if "code" in validated:
        role.code = validated["code"]
    if "description" in validated:
        role.description = validated["description"]
    if "is_active" in validated:
        role.is_active = validated["is_active"]

    db.session.commit()

    ip_address, user_agent = _get_client_metadata()
    audit = AuditLog(
        user_id=g.current_user.id,
        action="ROLE_UPDATED",
        resource="ApplicationRole",
        resource_id=str(role.id),
        ip_address=ip_address,
        user_agent=user_agent,
        details={"name": role.name, "is_active": role.is_active},
    )
    db.session.add(audit)
    db.session.commit()

    return api_response(
        data=_role_schema.dump(role),
        message=f"Role '{role.name}' updated successfully.",
        status_code=200,
    )


@candidates_bp.route("/roles/<uuid:role_id>/toggle-active", methods=["POST", "PATCH"])
@require_roles("admin")
def toggle_role_active(role_id):
    """Activate or deactivate a designation role (Admin only)."""
    role = db.session.get(ApplicationRole, role_id)
    if not role:
        raise NotFoundError("Role not found.")

    role.is_active = not role.is_active
    db.session.commit()

    action_label = "activated" if role.is_active else "deactivated"
    ip_address, user_agent = _get_client_metadata()
    audit = AuditLog(
        user_id=g.current_user.id,
        action="ROLE_STATUS_TOGGLED",
        resource="ApplicationRole",
        resource_id=str(role.id),
        ip_address=ip_address,
        user_agent=user_agent,
        details={"name": role.name, "is_active": role.is_active},
    )
    db.session.add(audit)
    db.session.commit()

    return api_response(
        data=_role_schema.dump(role),
        message=f"Role '{role.name}' {action_label} successfully.",
        status_code=200,
    )
