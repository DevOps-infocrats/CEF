import uuid
from flask import Blueprint, request, g
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload, selectinload
from app.extensions import db
from app.common.responses import api_response
from app.common.errors.exceptions import NotFoundError, ConflictError, ValidationError
from app.common.permissions.decorators import require_roles
from app.modules.auth.models import AuditLog
from app.modules.locations.models import LocationState, LocationDistrict, LocationBlock
from app.modules.locations.schemas import (
    LocationStateSchema,
    LocationDistrictSchema,
    LocationBlockSchema,
    CreateLocationStateSchema,
    UpdateLocationStateSchema,
    CreateLocationDistrictSchema,
    UpdateLocationDistrictSchema,
    CreateLocationBlockSchema,
    UpdateLocationBlockSchema,
)
from app.modules.locations.importer import import_location_excel

locations_bp = Blueprint("locations", __name__, url_prefix="/api/v1/locations")

_state_schema = LocationStateSchema()
_states_list_schema = LocationStateSchema(many=True)
_create_state_schema = CreateLocationStateSchema()
_update_state_schema = UpdateLocationStateSchema()

_district_schema = LocationDistrictSchema()
_districts_list_schema = LocationDistrictSchema(many=True)
_create_district_schema = CreateLocationDistrictSchema()
_update_district_schema = UpdateLocationDistrictSchema()

_block_schema = LocationBlockSchema()
_blocks_list_schema = LocationBlockSchema(many=True)
_create_block_schema = CreateLocationBlockSchema()
_update_block_schema = UpdateLocationBlockSchema()


def _is_admin_request() -> bool:
    """Check if the optional caller is an authenticated admin."""
    try:
        from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
        from app.modules.auth.models import User
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if identity:
            u_id = uuid.UUID(str(identity))
            u = db.session.get(User, u_id)
            if u and "admin" in u.role_names:
                return True
    except Exception:
        pass
    return False


def _get_client_metadata():
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()
    ua = request.headers.get("User-Agent", "Unknown")[:255]
    return ip, ua


# -------------------------------------------------------------
# States / Circles Endpoints
# -------------------------------------------------------------

@locations_bp.route("/states", methods=["GET"])
def list_states():
    """List states / operating circles."""
    include_all = request.args.get("all", "").lower() in ("true", "1")
    is_admin = _is_admin_request()

    stmt = select(LocationState).order_by(LocationState.name.asc())
    if not (include_all and is_admin):
        stmt = stmt.where(LocationState.is_active.is_(True))

    states = list(db.session.execute(stmt).scalars().all())
    return api_response(
        data=_states_list_schema.dump(states),
        message="States retrieved successfully.",
        status_code=200,
    )


@locations_bp.route("/states", methods=["POST"])
@require_roles("admin")
def create_state():
    """Create a new administrative state/circle."""
    payload = request.get_json(silent=True) or {}
    validated = _create_state_schema.load(payload)
    name = validated["name"].strip()

    existing = db.session.execute(
        select(LocationState).where(func.lower(LocationState.name) == name.lower())
    ).scalar_one_or_none()
    if existing:
        raise ConflictError(f"A state with name '{name}' already exists.")

    state = LocationState(
        name=name,
        code=validated.get("code"),
        is_active=validated.get("is_active", True),
    )
    db.session.add(state)
    db.session.commit()

    ip, ua = _get_client_metadata()
    audit = AuditLog(
        user_id=g.current_user.id,
        action="LOCATION_STATE_CREATED",
        resource="LocationState",
        resource_id=str(state.id),
        ip_address=ip,
        user_agent=ua,
        details={"name": state.name},
    )
    db.session.add(audit)
    db.session.commit()

    return api_response(
        data=_state_schema.dump(state),
        message=f"State '{state.name}' created successfully.",
        status_code=201,
    )


@locations_bp.route("/states/<uuid:state_id>", methods=["PUT"])
@require_roles("admin")
def update_state(state_id):
    """Update state name, code, or active status."""
    state = db.session.get(LocationState, state_id)
    if not state:
        raise NotFoundError("State not found.")

    payload = request.get_json(silent=True) or {}
    validated = _update_state_schema.load(payload)

    if "name" in validated and validated["name"]:
        new_name = validated["name"].strip()
        existing = db.session.execute(
            select(LocationState).where(
                func.lower(LocationState.name) == new_name.lower(),
                LocationState.id != state.id,
            )
        ).scalar_one_or_none()
        if existing:
            raise ConflictError(f"A state with name '{new_name}' already exists.")
        state.name = new_name

    if "code" in validated:
        state.code = validated["code"]
    if "is_active" in validated:
        state.is_active = validated["is_active"]

    db.session.commit()
    return api_response(
        data=_state_schema.dump(state),
        message="State updated successfully.",
        status_code=200,
    )


# -------------------------------------------------------------
# Districts Endpoints
# -------------------------------------------------------------

@locations_bp.route("/states/<uuid:state_id>/districts", methods=["GET"])
def list_districts_by_state(state_id):
    """List districts under a given state/circle."""
    state = db.session.get(LocationState, state_id)
    if not state:
        raise NotFoundError("State not found.")

    include_all = request.args.get("all", "").lower() in ("true", "1")
    is_admin = _is_admin_request()

    stmt = (
        select(LocationDistrict)
        .where(LocationDistrict.state_id == state_id)
        .options(selectinload(LocationDistrict.blocks))
        .order_by(LocationDistrict.name.asc())
    )
    if not (include_all and is_admin):
        stmt = stmt.where(LocationDistrict.is_active.is_(True))

    districts = list(db.session.execute(stmt).scalars().all())
    return api_response(
        data=_districts_list_schema.dump(districts),
        message=f"Districts for state '{state.name}' retrieved successfully.",
        status_code=200,
    )


@locations_bp.route("/states/<uuid:state_id>/districts", methods=["POST"])
@require_roles("admin")
def create_district(state_id):
    """Create a new district under a state."""
    state = db.session.get(LocationState, state_id)
    if not state:
        raise NotFoundError("State not found.")

    payload = request.get_json(silent=True) or {}
    validated = _create_district_schema.load(payload)
    name = validated["name"].strip()

    existing = db.session.execute(
        select(LocationDistrict).where(
            LocationDistrict.state_id == state_id,
            func.lower(LocationDistrict.name) == name.lower(),
        )
    ).scalar_one_or_none()
    if existing:
        raise ConflictError(f"District '{name}' already exists in state '{state.name}'.")

    district = LocationDistrict(
        state_id=state_id,
        name=name,
        code=validated.get("code"),
        is_active=validated.get("is_active", True),
    )
    db.session.add(district)
    db.session.commit()

    ip, ua = _get_client_metadata()
    audit = AuditLog(
        user_id=g.current_user.id,
        action="LOCATION_DISTRICT_CREATED",
        resource="LocationDistrict",
        resource_id=str(district.id),
        ip_address=ip,
        user_agent=ua,
        details={"name": district.name, "state": state.name},
    )
    db.session.add(audit)
    db.session.commit()

    return api_response(
        data=_district_schema.dump(district),
        message=f"District '{district.name}' created successfully.",
        status_code=201,
    )


@locations_bp.route("/districts/<uuid:district_id>", methods=["PUT"])
@require_roles("admin")
def update_district(district_id):
    """Update district details."""
    district = db.session.get(LocationDistrict, district_id)
    if not district:
        raise NotFoundError("District not found.")

    payload = request.get_json(silent=True) or {}
    validated = _update_district_schema.load(payload)

    if "name" in validated and validated["name"]:
        new_name = validated["name"].strip()
        existing = db.session.execute(
            select(LocationDistrict).where(
                LocationDistrict.state_id == district.state_id,
                func.lower(LocationDistrict.name) == new_name.lower(),
                LocationDistrict.id != district.id,
            )
        ).scalar_one_or_none()
        if existing:
            raise ConflictError(f"District '{new_name}' already exists in this state.")
        district.name = new_name

    if "code" in validated:
        district.code = validated["code"]
    if "is_active" in validated:
        district.is_active = validated["is_active"]

    db.session.commit()
    return api_response(
        data=_district_schema.dump(district),
        message="District updated successfully.",
        status_code=200,
    )


# -------------------------------------------------------------
# Blocks Endpoints
# -------------------------------------------------------------

@locations_bp.route("/blocks", methods=["GET"])
def list_blocks():
    """List blocks for given district_ids or district_id or state_id."""
    district_ids_param = request.args.get("district_ids", "")
    single_district_id = request.args.get("district_id", "")
    state_id_param = request.args.get("state_id", "")

    district_uuids = []
    if district_ids_param:
        for raw in district_ids_param.split(","):
            raw = raw.strip()
            if raw:
                try:
                    district_uuids.append(uuid.UUID(raw))
                except ValueError:
                    pass
    elif single_district_id:
        try:
            district_uuids.append(uuid.UUID(single_district_id.strip()))
        except ValueError:
            pass

    include_all = request.args.get("all", "").lower() in ("true", "1")
    is_admin = _is_admin_request()

    stmt = (
        select(LocationBlock)
        .join(LocationDistrict)
        .options(joinedload(LocationBlock.district))
        .order_by(LocationDistrict.name.asc(), LocationBlock.name.asc())
    )

    if district_uuids:
        stmt = stmt.where(LocationBlock.district_id.in_(district_uuids))
    elif state_id_param:
        try:
            st_id = uuid.UUID(state_id_param.strip())
            stmt = stmt.where(LocationDistrict.state_id == st_id)
        except ValueError:
            pass

    if not (include_all and is_admin):
        stmt = stmt.where(LocationBlock.is_active.is_(True), LocationDistrict.is_active.is_(True))

    blocks = list(db.session.execute(stmt).scalars().all())
    return api_response(
        data=_blocks_list_schema.dump(blocks),
        message="Blocks retrieved successfully.",
        status_code=200,
    )


@locations_bp.route("/districts/<uuid:district_id>/blocks", methods=["POST"])
@require_roles("admin")
def create_block(district_id):
    """Create a new block under a district."""
    district = db.session.get(LocationDistrict, district_id)
    if not district:
        raise NotFoundError("District not found.")

    payload = request.get_json(silent=True) or {}
    validated = _create_block_schema.load(payload)
    name = validated["name"].strip()

    existing = db.session.execute(
        select(LocationBlock).where(
            LocationBlock.district_id == district_id,
            func.lower(LocationBlock.name) == name.lower(),
        )
    ).scalar_one_or_none()
    if existing:
        raise ConflictError(f"Block '{name}' already exists in district '{district.name}'.")

    block = LocationBlock(
        district_id=district_id,
        name=name,
        code=validated.get("code"),
        is_active=validated.get("is_active", True),
    )
    db.session.add(block)
    db.session.commit()

    ip, ua = _get_client_metadata()
    audit = AuditLog(
        user_id=g.current_user.id,
        action="LOCATION_BLOCK_CREATED",
        resource="LocationBlock",
        resource_id=str(block.id),
        ip_address=ip,
        user_agent=ua,
        details={"name": block.name, "district": district.name},
    )
    db.session.add(audit)
    db.session.commit()

    return api_response(
        data=_block_schema.dump(block),
        message=f"Block '{block.name}' created successfully.",
        status_code=201,
    )


@locations_bp.route("/blocks/<uuid:block_id>", methods=["PUT"])
@require_roles("admin")
def update_block(block_id):
    """Update block details."""
    block = db.session.get(LocationBlock, block_id)
    if not block:
        raise NotFoundError("Block not found.")

    payload = request.get_json(silent=True) or {}
    validated = _update_block_schema.load(payload)

    if "name" in validated and validated["name"]:
        new_name = validated["name"].strip()
        existing = db.session.execute(
            select(LocationBlock).where(
                LocationBlock.district_id == block.district_id,
                func.lower(LocationBlock.name) == new_name.lower(),
                LocationBlock.id != block.id,
            )
        ).scalar_one_or_none()
        if existing:
            raise ConflictError(f"Block '{new_name}' already exists in this district.")
        block.name = new_name

    if "code" in validated:
        block.code = validated["code"]
    if "is_active" in validated:
        block.is_active = validated["is_active"]

    db.session.commit()
    return api_response(
        data=_block_schema.dump(block),
        message="Block updated successfully.",
        status_code=200,
    )


# -------------------------------------------------------------
# Excel Import Endpoint
# -------------------------------------------------------------

@locations_bp.route("/import", methods=["POST"])
@require_roles("admin")
def import_locations():
    """Import Location Master (District & Block Mapping) from Excel file (Admin only)."""
    if "file" not in request.files:
        raise ValidationError("No Excel file provided. Upload an Excel workbook (.xlsx/.xls).")

    file = request.files["file"]
    if not file.filename:
        raise ValidationError("Uploaded file has no filename.")

    allowed_exts = {".xlsx", ".xls"}
    import os
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise ValidationError("Invalid file type. Only Excel (.xlsx, .xls) files are supported.")

    file_bytes = file.read()
    if len(file_bytes) == 0:
        raise ValidationError("The uploaded file is empty.")

    state_name = request.form.get("state_name", "").strip() or "Rajasthan"
    state_code = request.form.get("state_code", "").strip() or "RJ"
    dry_run = request.form.get("dry_run", "").lower() in ("true", "1")

    result = import_location_excel(
        file_bytes_or_path=file_bytes,
        state_name=state_name,
        state_code=state_code,
        dry_run=dry_run,
    )

    if not dry_run:
        ip, ua = _get_client_metadata()
        audit = AuditLog(
            user_id=g.current_user.id,
            action="LOCATION_EXCEL_IMPORTED",
            resource="LocationState",
            resource_id=result.get("state_id"),
            ip_address=ip,
            user_agent=ua,
            details={
                "state": result["state"],
                "total_districts": result["total_districts"],
                "total_blocks": result["total_blocks"],
                "created_districts": result["created_districts"],
                "created_blocks": result["created_blocks"],
            },
        )
        db.session.add(audit)
        db.session.commit()

    return api_response(
        data=result,
        message=f"Location import {'preview generated' if dry_run else 'completed'} successfully.",
        status_code=200,
    )
