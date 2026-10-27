import uuid
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload
from app.extensions import db
from app.modules.candidates.models import CandidateApplication, CandidateDocument


def _base_application_query():
    """Base query for CandidateApplication with eagerly loaded relationships to prevent N+1 queries."""
    from sqlalchemy.orm import raiseload
    return (
        select(CandidateApplication)
        .options(
            joinedload(CandidateApplication.reviewed_by).options(raiseload("*")),
            selectinload(CandidateApplication.verification_items),
            selectinload(CandidateApplication.documents),
            selectinload(CandidateApplication.selected_districts),
            selectinload(CandidateApplication.selected_blocks),
        )
    )


def get_application_by_id(app_id: str | uuid.UUID) -> Optional[CandidateApplication]:
    """Retrieve a single candidate application by primary key."""
    if isinstance(app_id, str):
        try:
            app_id = uuid.UUID(app_id)
        except (ValueError, TypeError):
            return None

    stmt = _base_application_query().where(CandidateApplication.id == app_id)
    return db.session.execute(stmt).scalar_one_or_none()


def get_applications_by_user_id(user_id: str | uuid.UUID) -> List[CandidateApplication]:
    """Retrieve all applications submitted by a specific user."""
    if isinstance(user_id, str):
        try:
            user_id = uuid.UUID(user_id)
        except (ValueError, TypeError):
            return []

    stmt = (
        _base_application_query()
        .where(CandidateApplication.user_id == user_id)
        .order_by(CandidateApplication.created_at.desc())
    )
    return list(db.session.execute(stmt).scalars().all())


def list_all_applications() -> List[CandidateApplication]:
    """Retrieve all candidate applications across the system (for authorized reviewers/admins)."""
    stmt = _base_application_query().order_by(CandidateApplication.created_at.desc())
    return list(db.session.execute(stmt).scalars().all())


def get_document_by_id(doc_id: str | uuid.UUID) -> Optional[CandidateDocument]:
    """Retrieve a single candidate document by primary key."""
    if isinstance(doc_id, str):
        try:
            doc_id = uuid.UUID(doc_id)
        except (ValueError, TypeError):
            return None

    stmt = select(CandidateDocument).where(CandidateDocument.id == doc_id)
    return db.session.execute(stmt).scalar_one_or_none()


def get_staged_documents_by_user_id(user_id: str | uuid.UUID) -> List[CandidateDocument]:
    """Retrieve all unattached/staged documents uploaded by a user."""
    if isinstance(user_id, str):
        try:
            user_id = uuid.UUID(user_id)
        except (ValueError, TypeError):
            return []

    stmt = (
        select(CandidateDocument)
        .where(CandidateDocument.user_id == user_id)
        .where(CandidateDocument.application_id.is_(None))
        .order_by(CandidateDocument.uploaded_at.desc())
    )
    return list(db.session.execute(stmt).scalars().all())
