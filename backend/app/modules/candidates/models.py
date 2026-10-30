import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, Any, TYPE_CHECKING
from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Uuid,
    Numeric,
    Integer,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.extensions import db

if TYPE_CHECKING:
    from app.modules.auth.models import User


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# Authoritative Allowed Values
HERO_CATEGORIES = ["Hero 1", "Hero 2"]
ROLES_APPLIED = ["HDD Operate", "HDD Tracker", "HDD Helper"]

# Verification Statuses
VERIFICATION_STATUS_PENDING = "PENDING"
VERIFICATION_STATUS_DONE = "DONE"
VERIFICATION_STATUS_REJECTED = "REJECTED"

# Overall Application Statuses
APPLICATION_STATUS_PENDING = "PENDING_VERIFICATION"
APPLICATION_STATUS_IN_PROGRESS = "IN_PROGRESS"
APPLICATION_STATUS_COMPLETE = "VERIFICATION_COMPLETE"
APPLICATION_STATUS_NEEDS_CORRECTION = "NEEDS_CORRECTION"
APPLICATION_STATUS_APPROVED = "APPROVED"
APPLICATION_STATUS_OFFER_ACCEPTED = "OFFER_ACCEPTED"
APPLICATION_STATUS_REJECTED = "REJECTED"

# Site Joining Statuses
JOINING_STATUS_NOT_JOINED = "NOT_JOINED"
JOINING_STATUS_PENDING = "PENDING"
JOINING_STATUS_JOINED = "JOINED"
VALID_JOINING_STATUSES = {JOINING_STATUS_NOT_JOINED, JOINING_STATUS_PENDING, JOINING_STATUS_JOINED}

# Document Categories
DOCUMENT_CATEGORIES_MANDATORY = ["aadhaar_card", "pan_card"]
DOCUMENT_CATEGORIES_BANK = ["bank_passbook", "cancelled_cheque"]
DOCUMENT_CATEGORIES_OPTIONAL = ["marksheet_10th", "marksheet_12th", "previous_employment"]
DOCUMENT_CATEGORIES = (
    DOCUMENT_CATEGORIES_MANDATORY
    + DOCUMENT_CATEGORIES_BANK
    + DOCUMENT_CATEGORIES_OPTIONAL
)


class CandidateApplication(db.Model):
    """Database model for Candidate Application records."""

    __tablename__ = "candidate_applications"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    application_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Selected Category & Role
    hero_category: Mapped[Optional[str]] = mapped_column(String(20), default="Hero 1", nullable=True, index=True)
    role_applied: Mapped[Optional[str]] = mapped_column(String(50), default="", nullable=True, index=True)

    # Personal Information
    full_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    mobile_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    aadhaar_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    pan_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Current Address
    current_address_line1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    current_address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    current_city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    current_state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    current_pincode: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    current_country: Mapped[Optional[str]] = mapped_column(String(100), default="India", nullable=True)

    # Permanent Address
    is_permanent_same: Mapped[bool] = mapped_column(Boolean, default=False, nullable=True)
    permanent_address_line1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    permanent_address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    permanent_city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    permanent_state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    permanent_pincode: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    permanent_country: Mapped[Optional[str]] = mapped_column(String(100), default="India", nullable=True)

    # Bank Details
    account_holder_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    bank_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    account_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ifsc_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    branch_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)

    # Step 4: Location Details
    circle: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    district: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    block: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # Step 4: Salary Details
    current_salary: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    asking_salary: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    negotiated_salary: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)

    # Joining Date
    joining_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Status & Timestamps
    status: Mapped[str] = mapped_column(String(50), default=APPLICATION_STATUS_PENDING, nullable=False)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reviewed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(
        String(1000),
        nullable=True,
    )
    offer_accepted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    offer_accepted_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    offer_acceptance_status: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )

    # Site Joining Tracking
    site_joining_status: Mapped[str] = mapped_column(String(50), default="NOT_JOINED", nullable=False)
    site_joining_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    site_joining_updated_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    site_joining_updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    site_joining_notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], backref="applications")
    created_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by_id])
    reviewed_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[reviewed_by_id])
    offer_accepted_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[offer_accepted_by_id])
    site_joining_updated_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[site_joining_updated_by_id])
    documents: Mapped[list["CandidateDocument"]] = relationship(
        "CandidateDocument",
        backref="application",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    verification_items: Mapped[list["CandidateVerificationItem"]] = relationship(
        "CandidateVerificationItem",
        backref="application",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="CandidateVerificationItem.created_at.asc()",
    )
    selected_districts: Mapped[list["CandidateApplicationDistrict"]] = relationship(
        "CandidateApplicationDistrict",
        backref="application",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="CandidateApplicationDistrict.district_name.asc()",
    )
    selected_blocks: Mapped[list["CandidateApplicationBlock"]] = relationship(
        "CandidateApplicationBlock",
        backref="application",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="CandidateApplicationBlock.block_name.asc()",
    )

    __table_args__ = (
        Index("idx_candidate_user_status", "user_id", "status"),
        Index("idx_candidate_hero_role", "hero_category", "role_applied"),
        Index("ix_candidate_applications_created_at", "created_at"),
        Index("idx_candidate_user_created", "user_id", "created_at"),
        Index("idx_candidate_status", "status"),
        Index("idx_candidate_site_joining", "site_joining_status"),
    )

    def __init__(
        self,
        application_number: str,
        user_id: uuid.UUID,
        created_by_id: Optional[uuid.UUID] = None,
        hero_category: Optional[str] = None,
        role_applied: Optional[str] = None,
        full_name: Optional[str] = None,
        mobile_number: Optional[str] = None,
        email: Optional[str] = None,
        aadhaar_number: Optional[str] = None,
        pan_number: Optional[str] = None,
        current_address_line1: Optional[str] = None,
        current_city: Optional[str] = None,
        current_state: Optional[str] = None,
        current_pincode: Optional[str] = None,
        permanent_address_line1: Optional[str] = None,
        permanent_city: Optional[str] = None,
        permanent_state: Optional[str] = None,
        permanent_pincode: Optional[str] = None,
        account_holder_name: Optional[str] = None,
        bank_name: Optional[str] = None,
        account_number: Optional[str] = None,
        ifsc_code: Optional[str] = None,
        circle: Optional[str] = None,
        district: Optional[str] = None,
        block: Optional[str] = None,
        current_salary: Optional[Any] = None,
        asking_salary: Optional[Any] = None,
        negotiated_salary: Optional[Any] = None,
        current_address_line2: Optional[str] = None,
        current_country: Optional[str] = "India",
        is_permanent_same: bool = False,
        permanent_address_line2: Optional[str] = None,
        permanent_country: Optional[str] = "India",
        branch_name: Optional[str] = None,
        status: str = APPLICATION_STATUS_PENDING,
        **kwargs: Any,
    ):
        self.application_number = application_number
        self.user_id = user_id
        self.created_by_id = created_by_id
        self.hero_category = hero_category
        self.role_applied = role_applied
        self.full_name = full_name
        self.mobile_number = mobile_number
        self.email = email
        self.aadhaar_number = aadhaar_number
        self.pan_number = pan_number
        self.current_address_line1 = current_address_line1
        self.current_address_line2 = current_address_line2
        self.current_city = current_city
        self.current_state = current_state
        self.current_pincode = current_pincode
        self.current_country = current_country
        self.is_permanent_same = is_permanent_same
        self.permanent_address_line1 = permanent_address_line1
        self.permanent_address_line2 = permanent_address_line2
        self.permanent_city = permanent_city
        self.permanent_state = permanent_state
        self.permanent_pincode = permanent_pincode
        self.permanent_country = permanent_country
        self.account_holder_name = account_holder_name
        self.bank_name = bank_name
        self.account_number = account_number
        self.ifsc_code = ifsc_code
        self.branch_name = branch_name
        self.circle = circle
        self.district = district
        self.block = block
        self.current_salary = (
            Decimal(str(current_salary))
            if current_salary is not None and str(current_salary).strip() != ""
            else None
        )
        self.asking_salary = (
            Decimal(str(asking_salary))
            if asking_salary is not None and str(asking_salary).strip() != ""
            else None
        )
        self.negotiated_salary = (
            Decimal(str(negotiated_salary))
            if negotiated_salary is not None and str(negotiated_salary).strip() != ""
            else None
        )
        self.status = status
        for k, v in kwargs.items():
            setattr(self, k, v)


class CandidateDocument(db.Model):
    """Database model for Candidate uploaded documents."""

    __tablename__ = "candidate_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    application_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("candidate_applications.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", backref="documents")

    __table_args__ = (
        Index("idx_doc_user_category", "user_id", "category"),
        Index("idx_doc_app_category", "application_id", "category"),
        Index("idx_candidate_doc_staged", "user_id", "application_id", "uploaded_at"),
        Index("ix_candidate_documents_uploaded_at", "uploaded_at"),
    )

    def __init__(
        self,
        user_id: uuid.UUID,
        category: str,
        original_filename: str,
        storage_filename: str,
        file_path: str,
        content_type: str,
        file_size: int,
        application_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ):
        self.user_id = user_id
        self.category = category
        self.original_filename = original_filename
        self.storage_filename = storage_filename
        self.file_path = file_path
        self.content_type = content_type
        self.file_size = file_size
        self.application_id = application_id
        for k, v in kwargs.items():
            setattr(self, k, v)


class CandidateVerificationItem(db.Model):
    """Database model for individual verification checklist items."""

    __tablename__ = "candidate_verification_items"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("candidate_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("candidate_documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    item_key: Mapped[str] = mapped_column(String(50), nullable=False)
    item_label: Mapped[str] = mapped_column(String(100), nullable=False)
    item_category: Mapped[str] = mapped_column(String(50), nullable=False)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        default=VERIFICATION_STATUS_PENDING,
        nullable=False,
    )
    verified_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    remarks: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    # Relationships
    document: Mapped[Optional["CandidateDocument"]] = relationship("CandidateDocument")
    verified_by: Mapped[Optional["User"]] = relationship("User")

    __table_args__ = (
        UniqueConstraint("application_id", "item_key", name="uq_app_verification_item"),
        Index("idx_verification_app_status", "application_id", "status"),
    )

    def __init__(
        self,
        application_id: uuid.UUID,
        item_key: str,
        item_label: str,
        item_category: str,
        is_mandatory: bool = True,
        status: str = VERIFICATION_STATUS_PENDING,
        document_id: Optional[uuid.UUID] = None,
        verified_by_id: Optional[uuid.UUID] = None,
        verified_at: Optional[datetime] = None,
        remarks: Optional[str] = None,
        **kwargs: Any,
    ):
        self.application_id = application_id
        self.item_key = item_key
        self.item_label = item_label
        self.item_category = item_category
        self.is_mandatory = is_mandatory
        self.status = status
        self.document_id = document_id
        self.verified_by_id = verified_by_id
        self.verified_at = verified_at
        self.remarks = remarks
        for k, v in kwargs.items():
            setattr(self, k, v)


class ApplicationRole(db.Model):
    """Database model for dynamic candidate designation roles."""

    __tablename__ = "application_roles"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    def __init__(
        self,
        name: str,
        code: Optional[str] = None,
        description: Optional[str] = None,
        is_active: bool = True,
        **kwargs: Any,
    ):
        self.name = name.strip()
        self.code = code.strip() if code else None
        self.description = description.strip() if description else None
        self.is_active = is_active
        for k, v in kwargs.items():
            setattr(self, k, v)


class CandidateApplicationDistrict(db.Model):
    """District selection for a candidate application."""

    __tablename__ = "candidate_application_districts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("candidate_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    district_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("location_districts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    district_name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("application_id", "district_name", name="uq_app_district_name"),
    )

    def __init__(
        self,
        application_id: uuid.UUID,
        district_name: str,
        district_id: Optional[uuid.UUID] = None,
        id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ):
        if id is not None:
            self.id = id
        self.application_id = application_id
        self.district_id = district_id
        self.district_name = district_name
        for k, v in kwargs.items():
            setattr(self, k, v)


class CandidateApplicationBlock(db.Model):
    """Block selection for a candidate application."""

    __tablename__ = "candidate_application_blocks"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("candidate_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    block_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("location_blocks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    district_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("location_districts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    block_name: Mapped[str] = mapped_column(String(100), nullable=False)
    district_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("application_id", "block_name", "district_name", name="uq_app_block_dist_name"),
    )

    def __init__(
        self,
        application_id: uuid.UUID,
        block_name: str,
        block_id: Optional[uuid.UUID] = None,
        district_id: Optional[uuid.UUID] = None,
        district_name: Optional[str] = None,
        id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ):
        if id is not None:
            self.id = id
        self.application_id = application_id
        self.block_id = block_id
        self.district_id = district_id
        self.block_name = block_name
        self.district_name = district_name
        for k, v in kwargs.items():
            setattr(self, k, v)


