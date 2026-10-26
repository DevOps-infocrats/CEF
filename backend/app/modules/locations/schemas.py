from marshmallow import Schema, fields, validate


class LocationBlockSchema(Schema):
    """Schema for LocationBlock serialization."""

    id = fields.UUID(dump_only=True)
    district_id = fields.UUID(dump_only=True)
    district_name = fields.Method("get_district_name", dump_only=True)
    name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    code = fields.String(allow_none=True)
    is_active = fields.Boolean(dump_only=True)
    created_at = fields.DateTime(dump_only=True)

    def get_district_name(self, obj):
        return obj.district.name if obj.district else None


class LocationDistrictSchema(Schema):
    """Schema for LocationDistrict serialization."""

    id = fields.UUID(dump_only=True)
    state_id = fields.UUID(dump_only=True)
    state_name = fields.Method("get_state_name", dump_only=True)
    name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    code = fields.String(allow_none=True)
    is_active = fields.Boolean(dump_only=True)
    blocks_count = fields.Method("get_blocks_count", dump_only=True)
    created_at = fields.DateTime(dump_only=True)

    def get_state_name(self, obj):
        return obj.state.name if obj.state else None

    def get_blocks_count(self, obj):
        return len(obj.blocks) if obj.blocks else 0


class LocationStateSchema(Schema):
    """Schema for LocationState serialization."""

    id = fields.UUID(dump_only=True)
    name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    code = fields.String(allow_none=True)
    is_active = fields.Boolean(dump_only=True)
    districts_count = fields.Method("get_districts_count", dump_only=True)
    created_at = fields.DateTime(dump_only=True)

    def get_districts_count(self, obj):
        return len(obj.districts) if obj.districts else 0


class CreateLocationStateSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=2, max=100))
    code = fields.String(allow_none=True, validate=validate.Length(max=50))
    is_active = fields.Boolean(load_default=True)


class UpdateLocationStateSchema(Schema):
    name = fields.String(validate=validate.Length(min=2, max=100))
    code = fields.String(allow_none=True, validate=validate.Length(max=50))
    is_active = fields.Boolean()


class CreateLocationDistrictSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=2, max=100))
    code = fields.String(allow_none=True, validate=validate.Length(max=50))
    is_active = fields.Boolean(load_default=True)


class UpdateLocationDistrictSchema(Schema):
    name = fields.String(validate=validate.Length(min=2, max=100))
    code = fields.String(allow_none=True, validate=validate.Length(max=50))
    is_active = fields.Boolean()


class CreateLocationBlockSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=2, max=100))
    code = fields.String(allow_none=True, validate=validate.Length(max=50))
    is_active = fields.Boolean(load_default=True)


class UpdateLocationBlockSchema(Schema):
    name = fields.String(validate=validate.Length(min=2, max=100))
    code = fields.String(allow_none=True, validate=validate.Length(max=50))
    is_active = fields.Boolean()
