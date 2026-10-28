import re
from marshmallow import (
    Schema,
    fields,
    validate,
    validates,
    validates_schema,
    pre_load,
    ValidationError,
)
from typing import Optional, Dict, Any
from app.modules.candidates.models import (
    HERO_CATEGORIES,
    ROLES_APPLIED,
    DOCUMENT_CATEGORIES,
    VERIFICATION_STATUS_DONE,
    VERIFICATION_STATUS_PENDING,
)

PHONE_REGEX = re.compile(r"^(?:\+91|91)?[6-9]\d{9}$")
AADHAAR_REGEX = re.compile(r"^\d{12}$")
PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")
IFSC_REGEX = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")


class CandidateDocumentResponseSchema(Schema):
    """Serialization schema for CandidateDocument records."""

    id = fields.UUID(dump_only=True)
    application_id = fields.UUID(dump_only=True)
    category = fields.String(dump_only=True)
    original_filename = fields.String(dump_only=True)
    content_type = fields.String(dump_only=True)
    file_size = fields.Integer(dump_only=True)
    uploaded_at = fields.DateTime(dump_only=True)


class CandidateVerificationItemResponseSchema(Schema):
    """Serialization schema for CandidateVerificationItem records."""

    id = fields.UUID(dump_only=True)
    application_id = fields.UUID(dump_only=True)
    document_id = fields.UUID(dump_only=True, allow_none=True)
    item_key = fields.String(dump_only=True)
    item_label = fields.String(dump_only=True)
    item_category = fields.String(dump_only=True)
    is_mandatory = fields.Boolean(dump_only=True)
    status = fields.String(dump_only=True)
    verified_by_id = fields.UUID(dump_only=True, allow_none=True)
    verified_by_name = fields.Method("get_verifier_name", dump_only=True)
    verified_at = fields.DateTime(dump_only=True, allow_none=True)
    remarks = fields.String(dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    def get_verifier_name(self, obj) -> Optional[str]:
        if getattr(obj, "verified_by", None):
            return obj.verified_by.full_name or obj.verified_by.email
        return None


class UpdateVerificationItemSchema(Schema):
    """Payload schema for updating a verification checklist item."""

    remarks = fields.String(required=False, allow_none=True, validate=validate.Length(max=500))
    document_id = fields.UUID(required=False, allow_none=True)


class RejectCandidateSchema(Schema):
    """Payload schema for rejecting a candidate."""

    reason = fields.String(
        required=True,
        validate=validate.Length(min=3, max=1000, error="Rejection reason must be between 3 and 1000 characters."),
    )


class ApplicationRoleResponseSchema(Schema):
    """Serialization schema for ApplicationRole records."""

    id = fields.UUID(dump_only=True)
    name = fields.String(dump_only=True)
    code = fields.String(dump_only=True, allow_none=True)
    description = fields.String(dump_only=True, allow_none=True)
    is_active = fields.Boolean(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)


class CreateApplicationRoleSchema(Schema):
    """Validation schema for creating a dynamic designation role."""

    name = fields.String(required=True, validate=validate.Length(min=2, max=100))
    code = fields.String(required=False, allow_none=True, validate=validate.Length(max=50))
    description = fields.String(required=False, allow_none=True, validate=validate.Length(max=255))
    is_active = fields.Boolean(required=False, load_default=True)


class UpdateApplicationRoleSchema(Schema):
    """Validation schema for updating a dynamic designation role."""

    name = fields.String(required=False, validate=validate.Length(min=2, max=100))
    code = fields.String(required=False, allow_none=True, validate=validate.Length(max=50))
    description = fields.String(required=False, allow_none=True, validate=validate.Length(max=255))
    is_active = fields.Boolean(required=False)


class CreateCandidateApplicationSchema(Schema):
    """Validation schema for candidate application submissions."""

    hero_category = fields.String(
        required=False,
        allow_none=True,
        load_default="Hero 1",
        validate=validate.OneOf(HERO_CATEGORIES + [""], error="Invalid Hero category selected."),
    )
    role_applied = fields.String(
        required=False,
        allow_none=True,
        load_default="",
    )

    @validates("role_applied")
    def validate_role_applied(self, value: Optional[str]):
        if not value or not value.strip():
            return
        from app.modules.candidates.models import ApplicationRole, ROLES_APPLIED
        from app.extensions import db
        from sqlalchemy import select
        val = value.strip().lower()
        role = db.session.execute(
            select(ApplicationRole).where(
                db.func.lower(ApplicationRole.name) == val,
            )
        ).scalar_one_or_none()
        if role:
            if not role.is_active:
                raise ValidationError(f"Role '{value}' has been deactivated and is not available for new applications.")
        else:
            if value.strip() not in ROLES_APPLIED:
                raise ValidationError(f"Invalid role choice '{value}' selected.")

    # Personal Information
    full_name = fields.String(required=False, allow_none=True, validate=validate.Length(max=150))
    mobile_number = fields.String(required=False, allow_none=True)
    email = fields.Email(required=False, allow_none=True, validate=validate.Length(max=255))
    aadhaar_number = fields.String(required=False, allow_none=True)
    pan_number = fields.String(required=False, allow_none=True)

    # Current Address
    current_address_line1 = fields.String(required=False, allow_none=True, validate=validate.Length(max=255))
    current_address_line2 = fields.String(required=False, allow_none=True, validate=validate.Length(max=255))
    current_city = fields.String(required=False, allow_none=True, validate=validate.Length(max=100))
    current_state = fields.String(required=False, allow_none=True, validate=validate.Length(max=100))
    current_pincode = fields.String(required=False, allow_none=True, validate=validate.Length(max=20))
    current_pin_code = fields.String(required=False, allow_none=True, load_only=True)
    current_country = fields.String(required=False, allow_none=True, load_default="India", validate=validate.Length(max=100))

    # Permanent Address
    is_permanent_same = fields.Boolean(required=False, load_default=False)
    permanent_address_line1 = fields.String(required=False, allow_none=True, validate=validate.Length(max=255))
    permanent_address_line2 = fields.String(required=False, allow_none=True, validate=validate.Length(max=255))
    permanent_city = fields.String(required=False, allow_none=True, validate=validate.Length(max=100))
    permanent_state = fields.String(required=False, allow_none=True, validate=validate.Length(max=100))
    permanent_pincode = fields.String(required=False, allow_none=True, validate=validate.Length(max=20))
    permanent_pin_code = fields.String(required=False, allow_none=True, load_only=True)
    permanent_country = fields.String(required=False, allow_none=True, load_default="India", validate=validate.Length(max=100))

    # Bank Details
    account_holder_name = fields.String(required=False, allow_none=True, validate=validate.Length(max=150))
    bank_name = fields.String(required=False, allow_none=True, validate=validate.Length(max=150))
    account_number = fields.String(required=False, allow_none=True, validate=validate.Length(max=50))
    confirm_account_number = fields.String(required=False, allow_none=True, load_only=True)
    ifsc_code = fields.String(required=False, allow_none=True)
    branch_name = fields.String(required=False, allow_none=True, validate=validate.Length(max=150))

    # Step 4: Location Details
    circle = fields.String(required=False, allow_none=True, validate=validate.Length(max=100))
    district = fields.String(required=False, allow_none=True, validate=validate.Length(max=500))
    block = fields.String(required=False, allow_none=True, validate=validate.Length(max=1000))
    district_ids = fields.List(fields.UUID(), required=False, allow_none=True)
    block_ids = fields.List(fields.UUID(), required=False, allow_none=True)

    # Step 4: Salary Details
    current_salary = fields.Decimal(
        as_string=True,
        required=False,
        allow_none=True,
        validate=validate.Range(min=0, error="Current salary cannot be negative."),
    )
    asking_salary = fields.Decimal(
        as_string=True,
        required=False,
        allow_none=True,
        validate=validate.Range(min=0, error="Asking salary cannot be negative."),
    )
    negotiated_salary = fields.Decimal(
        as_string=True,
        required=False,
        allow_none=True,
        validate=validate.Range(min=0, error="Negotiated salary cannot be negative."),
    )

    # Optional explicit document IDs to associate
    document_ids = fields.List(fields.UUID(), required=False, allow_none=True)

    @pre_load
    def normalize_payload(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        payload = dict(data)

        # Normalize pin code aliases
        if "current_pin_code" in payload and not payload.get("current_pincode"):
            payload["current_pincode"] = payload["current_pin_code"]
        if "permanent_pin_code" in payload and not payload.get("permanent_pincode"):
            payload["permanent_pincode"] = payload["permanent_pin_code"]

        # If permanent address is same as current, copy fields if missing
        if payload.get("is_permanent_same"):
            field_map = {
                "address_line1": "current_address_line1",
                "address_line2": "current_address_line2",
                "city": "current_city",
                "state": "current_state",
                "pincode": "current_pincode",
                "country": "current_country",
            }
            for perm_suffix, curr_key in field_map.items():
                perm_key = f"permanent_{perm_suffix}"
                if not payload.get(perm_key) and payload.get(curr_key):
                    payload[perm_key] = payload[curr_key]

        # Convert empty strings to None for fields marshmallow would otherwise reject
        for f in ["email", "current_salary", "asking_salary", "negotiated_salary"]:
            if payload.get(f) == "":
                payload[f] = None

        return payload

    @validates("mobile_number")
    def validate_phone(self, value: Optional[str]) -> None:
        if not value or not str(value).strip():
            return
        clean = value.replace(" ", "").replace("-", "")
        if not PHONE_REGEX.match(clean):
            raise ValidationError("Please provide a valid 10-digit mobile number.")

    @validates("aadhaar_number")
    def validate_aadhaar(self, value: Optional[str]) -> None:
        if not value or not str(value).strip():
            return
        clean = value.replace(" ", "").replace("-", "")
        if not AADHAAR_REGEX.match(clean):
            raise ValidationError("Aadhaar number must be exactly 12 numeric digits.")

    @validates("pan_number")
    def validate_pan(self, value: Optional[str]) -> None:
        if not value or not str(value).strip():
            return
        clean = value.replace(" ", "").strip().upper()
        if not PAN_REGEX.match(clean):
            raise ValidationError("PAN must follow valid standard format (e.g., ABCDE1234F).")

    @validates("ifsc_code")
    def validate_ifsc(self, value: Optional[str]) -> None:
        if not value or not str(value).strip():
            return
        clean = value.replace(" ", "").strip().upper()
        if not IFSC_REGEX.match(clean):
            raise ValidationError("IFSC code must follow valid 11-character format (e.g., SBIN0001234).")

    @validates_schema
    def validate_bank_account_match(self, data, **kwargs):
        acc = data.get("account_number")
        confirm = data.get("confirm_account_number")
        if not acc and not confirm:
            return
        if (acc or "").strip() != (confirm or "").strip():
            raise ValidationError(
                {"confirm_account_number": ["Account number and confirmation do not match."]}
            )

    @validates_schema
    def validate_location_allocation(self, data, **kwargs):
        district_ids = data.get("district_ids")
        block_ids = data.get("block_ids")

        if district_ids:
            from app.modules.locations.models import LocationDistrict, LocationBlock, LocationState
            from app.extensions import db
            from sqlalchemy import select

            circle_name = (data.get("circle") or "").strip()
            state = None
            if circle_name:
                state = db.session.execute(
                    select(LocationState).where(db.func.lower(LocationState.name) == circle_name.lower())
                ).scalar_one_or_none()

            districts = list(
                db.session.execute(
                    select(LocationDistrict).where(LocationDistrict.id.in_(district_ids))
                ).scalars().all()
            )
            found_dist_ids = {d.id for d in districts}
            missing_dist_ids = set(district_ids) - found_dist_ids
            if missing_dist_ids:
                raise ValidationError({"district_ids": ["One or more selected districts were not found."]})

            if state:
                for d in districts:
                    if d.state_id != state.id:
                        raise ValidationError(
                            {"district_ids": [f"District '{d.name}' does not belong to the selected circle/state '{state.name}'."]}
                        )

            if block_ids:
                blocks = list(
                    db.session.execute(
                        select(LocationBlock).where(LocationBlock.id.in_(block_ids))
                    ).scalars().all()
                )
                found_blk_ids = {b.id for b in blocks}
                missing_blk_ids = set(block_ids) - found_blk_ids
                if missing_blk_ids:
                    raise ValidationError({"block_ids": ["One or more selected blocks were not found."]})

                for b in blocks:
                    if b.district_id not in found_dist_ids:
                        raise ValidationError(
                            {"block_ids": [f"Block '{b.name}' does not belong to any of the selected districts."]}
                        )

            data["_validated_districts"] = districts
            data["_validated_blocks"] = blocks if block_ids else []


class UpdateCandidateApplicationSchema(CreateCandidateApplicationSchema):
    """Validation schema for candidate application updates."""
    pass


class CandidateApplicationResponseSchema(Schema):
    """Serialization schema for Candidate Application records."""

    id = fields.UUID(dump_only=True)
    application_number = fields.String(dump_only=True)
    user_id = fields.UUID(dump_only=True)
    hero_category = fields.String(dump_only=True)
    role_applied = fields.String(dump_only=True)
    full_name = fields.String(dump_only=True)
    mobile_number = fields.String(dump_only=True)
    mobile_number_masked = fields.Method("get_masked_mobile", dump_only=True)
    email = fields.String(dump_only=True)
    aadhaar_masked = fields.Method("get_masked_aadhaar", dump_only=True)
    aadhaar_number_masked = fields.Method("get_masked_aadhaar", dump_only=True)
    pan_masked = fields.Method("get_masked_pan", dump_only=True)
    pan_number_masked = fields.Method("get_masked_pan", dump_only=True)

    # Protected raw sensitive fields (accessible only to authorized verifiers when explicitly permitted)
    aadhaar_number = fields.Method("get_raw_aadhaar", dump_only=True)
    pan_number = fields.Method("get_raw_pan", dump_only=True)
    account_number = fields.Method("get_raw_account", dump_only=True)

    # Current Address
    current_address_line1 = fields.String(dump_only=True)
    current_address_line2 = fields.String(dump_only=True)
    current_city = fields.String(dump_only=True)
    current_state = fields.String(dump_only=True)
    current_pincode = fields.String(dump_only=True)
    current_pin_code = fields.String(attribute="current_pincode", dump_only=True)
    current_country = fields.String(dump_only=True)

    # Permanent Address
    is_permanent_same = fields.Boolean(dump_only=True)
    permanent_address_line1 = fields.String(dump_only=True)
    permanent_address_line2 = fields.String(dump_only=True)
    permanent_city = fields.String(dump_only=True)
    permanent_state = fields.String(dump_only=True)
    permanent_pincode = fields.String(dump_only=True)
    permanent_pin_code = fields.String(attribute="permanent_pincode", dump_only=True)
    permanent_country = fields.String(dump_only=True)

    # Bank Details (masked for protection)
    account_holder_name = fields.String(dump_only=True)
    bank_name = fields.String(dump_only=True)
    account_number_masked = fields.Method("get_masked_account", dump_only=True)
    account_masked = fields.Method("get_masked_account", dump_only=True)
    ifsc_code = fields.String(dump_only=True)
    branch_name = fields.String(dump_only=True)

    # Step 4: Location & Salary Details
    circle = fields.String(dump_only=True)
    district = fields.String(dump_only=True)
    block = fields.String(dump_only=True)
    selected_districts = fields.Method("get_selected_districts", dump_only=True)
    selected_blocks = fields.Method("get_selected_blocks", dump_only=True)
    district_ids = fields.Method("get_district_ids", dump_only=True)
    block_ids = fields.Method("get_block_ids", dump_only=True)
    current_salary = fields.Decimal(as_string=True, dump_only=True)
    asking_salary = fields.Decimal(as_string=True, dump_only=True)
    negotiated_salary = fields.Decimal(as_string=True, dump_only=True, allow_none=True)
    joining_date = fields.String(dump_only=True, allow_none=True)

    # Step 5: Uploaded Documents
    documents = fields.Nested(CandidateDocumentResponseSchema, many=True, dump_only=True)

    # Verification Checklist & Progress
    verification_items = fields.Nested(CandidateVerificationItemResponseSchema, many=True, dump_only=True)
    verification_progress = fields.Method("get_verification_progress", dump_only=True)

    status = fields.String(dump_only=True)
    created_by_id = fields.UUID(dump_only=True, allow_none=True)
    created_by_name = fields.Method("get_creator_name", dump_only=True)
    reviewed_by_id = fields.UUID(dump_only=True, allow_none=True)
    reviewed_by_name = fields.Method("get_reviewer_name", dump_only=True)
    reviewed_at = fields.DateTime(dump_only=True, allow_none=True)
    rejection_reason = fields.String(dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    def get_creator_name(self, obj) -> Optional[str]:
        if getattr(obj, "created_by", None):
            return obj.created_by.full_name or obj.created_by.username or obj.created_by.email
        created_by_id = getattr(obj, "created_by_id", None)
        if created_by_id:
            from app.modules.auth.models import User
            from app.extensions import db
            creator = db.session.get(User, created_by_id)
            if creator:
                return creator.full_name or creator.username or creator.email
        return None

    def get_reviewer_name(self, obj) -> Optional[str]:
        if getattr(obj, "reviewed_by", None):
            return obj.reviewed_by.full_name or obj.reviewed_by.email
        return None

    def get_masked_mobile(self, obj) -> Optional[str]:
        raw = getattr(obj, "mobile_number", "") or ""
        if not raw:
            return None
        clean = re.sub(r"\D", "", raw)
        if len(clean) >= 10:
            return f"{clean[:2]}••••••{clean[-2:]}"
        return clean or None

    def get_masked_aadhaar(self, obj) -> Optional[str]:
        raw = getattr(obj, "aadhaar_number", "") or ""
        if not raw:
            return None
        return f"••••••••{raw[-4:]}" if len(raw) >= 4 else raw

    def get_masked_pan(self, obj) -> Optional[str]:
        raw = getattr(obj, "pan_number", "") or ""
        if not raw:
            return None
        return f"••••••{raw[-4:]}" if len(raw) >= 4 else raw

    def get_masked_account(self, obj) -> Optional[str]:
        raw = getattr(obj, "account_number", "") or ""
        if not raw:
            return None
        return f"••••••••{raw[-4:]}" if len(raw) >= 4 else raw

    def get_raw_aadhaar(self, obj) -> Optional[str]:
        if self.context.get("allow_unmasked"):
            return getattr(obj, "aadhaar_number", None)
        return None

    def get_raw_pan(self, obj) -> Optional[str]:
        if self.context.get("allow_unmasked"):
            return getattr(obj, "pan_number", None)
        return None

    def get_raw_account(self, obj) -> Optional[str]:
        if self.context.get("allow_unmasked"):
            return getattr(obj, "account_number", None)
        return None

    def get_selected_districts(self, obj) -> list:
        items = getattr(obj, "selected_districts", None)
        if items:
            return [{"id": str(d.district_id) if d.district_id else None, "name": d.district_name} for d in items]
        raw = getattr(obj, "district", "") or ""
        return [{"id": None, "name": d.strip()} for d in raw.split(",") if d.strip()]

    def get_selected_blocks(self, obj) -> list:
        items = getattr(obj, "selected_blocks", None)
        if items:
            return [
                {
                    "id": str(b.block_id) if b.block_id else None,
                    "name": b.block_name,
                    "district_id": str(b.district_id) if b.district_id else None,
                    "district_name": b.district_name,
                }
                for b in items
            ]
        raw = getattr(obj, "block", "") or ""
        return [{"id": None, "name": b.strip(), "district_id": None, "district_name": None} for b in raw.split(",") if b.strip()]

    def get_district_ids(self, obj) -> list:
        items = getattr(obj, "selected_districts", None)
        if items:
            return [str(d.district_id) for d in items if d.district_id]
        return []

    def get_block_ids(self, obj) -> list:
        items = getattr(obj, "selected_blocks", None)
        if items:
            return [str(b.block_id) for b in items if b.block_id]
        return []

    def get_verification_progress(self, obj) -> Dict[str, Any]:
        items = getattr(obj, "verification_items", []) or []
        total = len(items)
        completed = sum(1 for item in items if item.status == VERIFICATION_STATUS_DONE)
        mandatory_items = [item for item in items if item.is_mandatory]
        mandatory_total = len(mandatory_items)
        mandatory_completed = sum(1 for item in mandatory_items if item.status == VERIFICATION_STATUS_DONE)
        percentage = round((completed / total * 100)) if total > 0 else 0
        return {
            "total_items": total,
            "completed_items": completed,
            "mandatory_items": mandatory_total,
            "completed_mandatory_items": mandatory_completed,
            "percentage": percentage,
        }
