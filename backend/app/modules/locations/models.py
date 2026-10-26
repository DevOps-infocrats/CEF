import uuid
from datetime import datetime, timezone
from typing import Optional, List, Any
from sqlalchemy import String, Boolean, DateTime, ForeignKey, UniqueConstraint, Index, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.extensions import db


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class LocationState(db.Model):
    """Administrative State / Circle in Location Master."""

    __tablename__ = "location_states"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    districts: Mapped[List["LocationDistrict"]] = relationship(
        "LocationDistrict",
        back_populates="state",
        cascade="all, delete-orphan",
        order_by="LocationDistrict.name.asc()",
        lazy="selectin",
    )

    def __init__(
        self,
        name: str,
        code: Optional[str] = None,
        is_active: bool = True,
        id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ):
        if id is not None:
            self.id = id
        self.name = name.strip() if name else name
        self.code = code.strip() if code else None
        self.is_active = is_active
        for k, v in kwargs.items():
            setattr(self, k, v)

    def __repr__(self) -> str:
        return f"<LocationState {self.name}>"


class LocationDistrict(db.Model):
    """District under an Administrative State."""

    __tablename__ = "location_districts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    state_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("location_states.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    state: Mapped["LocationState"] = relationship("LocationState", back_populates="districts")
    blocks: Mapped[List["LocationBlock"]] = relationship(
        "LocationBlock",
        back_populates="district",
        cascade="all, delete-orphan",
        order_by="LocationBlock.name.asc()",
        lazy="select",
    )

    __table_args__ = (
        UniqueConstraint("state_id", "name", name="uq_district_state_name"),
        Index("idx_district_state_active", "state_id", "is_active"),
    )

    def __init__(
        self,
        state_id: uuid.UUID,
        name: str,
        code: Optional[str] = None,
        is_active: bool = True,
        id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ):
        if id is not None:
            self.id = id
        self.state_id = state_id
        self.name = name.strip() if name else name
        self.code = code.strip() if code else None
        self.is_active = is_active
        for k, v in kwargs.items():
            setattr(self, k, v)

    def __repr__(self) -> str:
        return f"<LocationDistrict {self.name} (state_id={self.state_id})>"


class LocationBlock(db.Model):
    """Development / Operational Block under a District."""

    __tablename__ = "location_blocks"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    district_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("location_districts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    district: Mapped["LocationDistrict"] = relationship("LocationDistrict", back_populates="blocks")

    __table_args__ = (
        UniqueConstraint("district_id", "name", name="uq_block_district_name"),
        Index("idx_block_district_active", "district_id", "is_active"),
    )

    def __init__(
        self,
        district_id: uuid.UUID,
        name: str,
        code: Optional[str] = None,
        is_active: bool = True,
        id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ):
        if id is not None:
            self.id = id
        self.district_id = district_id
        self.name = name.strip() if name else name
        self.code = code.strip() if code else None
        self.is_active = is_active
        for k, v in kwargs.items():
            setattr(self, k, v)

    def __repr__(self) -> str:
        return f"<LocationBlock {self.name} (district_id={self.district_id})>"
