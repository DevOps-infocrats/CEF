import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, TYPE_CHECKING
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Index, Text, JSON, Uuid, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.extensions import db

if TYPE_CHECKING:
    from app.modules.auth.models import User
    from app.modules.candidates.models import CandidateApplication


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


TEMPLATE_TYPE_LOI = "letter_of_intent"
TEMPLATE_TYPE_OFFER = "offer_letter"
VALID_TEMPLATE_TYPES = {TEMPLATE_TYPE_LOI, TEMPLATE_TYPE_OFFER}

LETTER_STATUS_DRAFT = "DRAFT"
LETTER_STATUS_FINAL = "FINAL"
LETTER_STATUS_SENT = "SENT"
LETTER_STATUS_ACCEPTED = "ACCEPTED"
LETTER_STATUS_FAILED = "FAILED"

DEFAULT_LOI_MAPPINGS = [
    {"placeholder": "{{current_date}}", "label": "Document Date", "description": "Current generation date formatted as DD/MM/YYYY"},
    {"placeholder": "{{candidate_full_name}}", "label": "Full Name", "description": "Candidate's verified full name"},
    {"placeholder": "{{candidate_address}}", "label": "Address", "description": "Candidate's registered residential address"},
    {"placeholder": "{{candidate_mobile}}", "label": "Mobile Number", "description": "Candidate's primary contact mobile"},
    {"placeholder": "{{candidate_email}}", "label": "Email Address", "description": "Candidate's registered email"},
    {"placeholder": "{{candidate_aadhaar}}", "label": "Aadhaar Number", "description": "Masked or full Aadhaar number"},
    {"placeholder": "{{approved_role_name}}", "label": "Designation / Role", "description": "Approved job designation"},
    {"placeholder": "{{approved_location}}", "label": "Work Location", "description": "Approved district and state"},
    {"placeholder": "{{joining_date}}", "label": "Joining Date", "description": "Agreed service commencement date"},
    {"placeholder": "{{monthly_salary}}", "label": "Monthly Salary", "description": "Approved monthly compensation"},
    {"placeholder": "{{total_salary}}", "label": "Total Compensation", "description": "Total monthly payable amount"},
]

DEFAULT_OFFER_MAPPINGS = [
    {"placeholder": "{{reference_number}}", "label": "Reference ID", "description": "Company appointment reference number"},
    {"placeholder": "{{current_date}}", "label": "Letter Date", "description": "Document issuance date"},
    {"placeholder": "{{candidate_full_name}}", "label": "Full Name", "description": "Candidate's verified legal name"},
    {"placeholder": "{{candidate_mobile}}", "label": "Mobile Number", "description": "Candidate's phone number"},
    {"placeholder": "{{approved_role_name}}", "label": "Designation / Role", "description": "Appointed job title"},
    {"placeholder": "{{approved_location}}", "label": "Posting Location", "description": "Approved station / location"},
    {"placeholder": "{{joining_date}}", "label": "Joining Date", "description": "Mandatory reporting date"},
    {"placeholder": "{{monthly_ctc}}", "label": "Monthly CTC", "description": "Monthly Cost to Company"},
    {"placeholder": "{{yearly_ctc}}", "label": "Annual CTC", "description": "Annual Cost to Company"},
    {"placeholder": "{{take_home_monthly}}", "label": "Net Take Home", "description": "Estimated monthly in-hand compensation"},
]


class DocumentTemplate(db.Model):
    """Database model for Master Letter Templates (Letter of Intent & Offer Letter)."""

    __tablename__ = "document_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    template_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    field_mappings: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
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

    created_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by_id])

    __table_args__ = (
        Index("idx_doc_template_active_type", "template_type", "is_active"),
    )

    def __init__(
        self,
        template_type: str,
        name: str,
        filename: str,
        storage_path: str,
        version: int = 1,
        is_active: bool = True,
        field_mappings: Optional[Any] = None,
        created_by_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ):
        self.template_type = template_type
        self.name = name
        self.filename = filename
        self.storage_path = storage_path
        self.version = version
        self.is_active = is_active
        self.field_mappings = field_mappings
        self.created_by_id = created_by_id
        for k, v in kwargs.items():
            setattr(self, k, v)


class CandidateLetter(db.Model):
    """Database model for candidate-specific generated letters, drafts, and dispatch tracking."""

    __tablename__ = "candidate_letters"

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
    template_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("document_templates.id", ondelete="SET NULL"),
        nullable=True,
    )
    letter_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default=LETTER_STATUS_DRAFT, nullable=False)
    docx_storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    pdf_storage_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    field_values: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)

    last_edited_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    last_edited_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    sent_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    email_recipient: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email_error: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    accepted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    accepted_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    accepted_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    accepted_user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

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
    application: Mapped["CandidateApplication"] = relationship("CandidateApplication", backref="letters")
    template: Mapped[Optional["DocumentTemplate"]] = relationship("DocumentTemplate")
    last_edited_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[last_edited_by_id])
    sent_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[sent_by_id])
    accepted_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[accepted_by_id])

    __table_args__ = (
        UniqueConstraint("application_id", "letter_type", name="uq_candidate_letter_app_type"),
        Index("idx_candidate_letter_app_type", "application_id", "letter_type"),
    )

    def __init__(
        self,
        application_id: uuid.UUID,
        letter_type: str,
        docx_storage_path: str,
        template_id: Optional[uuid.UUID] = None,
        version: int = 1,
        status: str = LETTER_STATUS_DRAFT,
        pdf_storage_path: Optional[str] = None,
        field_values: Optional[Any] = None,
        last_edited_by_id: Optional[uuid.UUID] = None,
        last_edited_at: Optional[datetime] = None,
        sent_at: Optional[datetime] = None,
        sent_by_id: Optional[uuid.UUID] = None,
        email_recipient: Optional[str] = None,
        email_status: Optional[str] = None,
        email_error: Optional[str] = None,
        accepted_at: Optional[datetime] = None,
        accepted_by_id: Optional[uuid.UUID] = None,
        accepted_ip: Optional[str] = None,
        accepted_user_agent: Optional[str] = None,
        **kwargs: Any,
    ):
        self.application_id = application_id
        self.letter_type = letter_type
        self.docx_storage_path = docx_storage_path
        self.template_id = template_id
        self.version = version
        self.status = status
        self.pdf_storage_path = pdf_storage_path
        self.field_values = field_values
        self.last_edited_by_id = last_edited_by_id
        self.last_edited_at = last_edited_at
        self.sent_at = sent_at
        self.sent_by_id = sent_by_id
        self.email_recipient = email_recipient
        self.email_status = email_status
        self.email_error = email_error
        self.accepted_at = accepted_at
        self.accepted_by_id = accepted_by_id
        self.accepted_ip = accepted_ip
        self.accepted_user_agent = accepted_user_agent
        for k, v in kwargs.items():
            setattr(self, k, v)

