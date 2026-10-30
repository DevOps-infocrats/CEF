import uuid
import zoneinfo
from datetime import datetime, date, time, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select, or_
from sqlalchemy.orm import joinedload, selectinload, raiseload
from app.extensions import db
from app.modules.auth.models import User
from app.modules.candidates.models import CandidateApplication, CandidateDocument
from app.modules.letters.models import CandidateLetter

REPORT_TIMEZONE_NAME = "Asia/Kolkata"
try:
    REPORT_TIMEZONE = zoneinfo.ZoneInfo(REPORT_TIMEZONE_NAME)
except Exception:
    REPORT_TIMEZONE = timezone.utc


def parse_date_boundary(date_val: Optional[str | datetime], is_end: bool = False) -> Optional[datetime]:
    """Parse a date string or datetime into UTC datetime boundary for DB comparison."""
    if not date_val:
        return None
    if isinstance(date_val, datetime):
        if date_val.tzinfo is None:
            date_val = date_val.replace(tzinfo=REPORT_TIMEZONE)
        return date_val.astimezone(timezone.utc)

    val_str = str(date_val).strip()
    if not val_str:
        return None

    try:
        # Date only: YYYY-MM-DD
        d = date.fromisoformat(val_str[:10])
        t = time(23, 59, 59, 999999) if is_end else time(0, 0, 0)
        dt_local = datetime.combine(d, t, tzinfo=REPORT_TIMEZONE)
        return dt_local.astimezone(timezone.utc)
    except Exception:
        try:
            dt = datetime.fromisoformat(val_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=REPORT_TIMEZONE)
            return dt.astimezone(timezone.utc)
        except Exception:
            return None


def _base_application_query():
    """Base query for CandidateApplication with eagerly loaded relationships to prevent N+1 queries."""
    return (
        select(CandidateApplication)
        .options(
            joinedload(CandidateApplication.reviewed_by).options(raiseload("*")),
            joinedload(CandidateApplication.created_by).options(raiseload("*")),
            joinedload(CandidateApplication.site_joining_updated_by).options(raiseload("*")),
            selectinload(CandidateApplication.verification_items),
            selectinload(CandidateApplication.documents),
            selectinload(CandidateApplication.selected_districts),
            selectinload(CandidateApplication.selected_blocks),
            selectinload(CandidateApplication.letters).joinedload(CandidateLetter.sent_by).options(raiseload("*")),
        )
    )


def query_applications(
    user_id: Optional[uuid.UUID] = None,
    candidate_name: Optional[str] = None,
    hr_name: Optional[str] = None,
    created_by_id: Optional[uuid.UUID] = None,
    start_date: Optional[str | datetime] = None,
    end_date: Optional[str | datetime] = None,
    status: Optional[str] = None,
) -> List[CandidateApplication]:
    """Query applications with multi-field filtering (HR name, Candidate name, Date range, Status)."""
    stmt = _base_application_query()

    if user_id:
        stmt = stmt.where(CandidateApplication.user_id == user_id)

    if created_by_id:
        stmt = stmt.where(CandidateApplication.created_by_id == created_by_id)

    if hr_name and hr_name.strip():
        term = f"%{hr_name.strip()}%"
        stmt = stmt.join(User, CandidateApplication.created_by_id == User.id).where(
            or_(
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                (User.first_name + " " + User.last_name).ilike(term),
                User.username.ilike(term),
                User.email.ilike(term),
            )
        )

    if candidate_name and candidate_name.strip():
        c_term = f"%{candidate_name.strip()}%"
        stmt = stmt.where(
            or_(
                CandidateApplication.full_name.ilike(c_term),
                CandidateApplication.application_number.ilike(c_term),
            )
        )

    start_dt = parse_date_boundary(start_date, is_end=False)
    if start_dt:
        stmt = stmt.where(CandidateApplication.created_at >= start_dt)

    end_dt = parse_date_boundary(end_date, is_end=True)
    if end_dt:
        stmt = stmt.where(CandidateApplication.created_at <= end_dt)

    if status and status.strip() and status.strip().upper() != "ALL":
        norm_status = status.strip().upper()
        if norm_status == "PENDING_VERIFICATION":
            stmt = stmt.where(CandidateApplication.status.in_(["PENDING_VERIFICATION", "SUBMITTED"]))
        else:
            stmt = stmt.where(CandidateApplication.status == status.strip())

    stmt = stmt.order_by(CandidateApplication.created_at.desc())
    return list(db.session.execute(stmt).scalars().all())


def get_application_creators(user_id: Optional[uuid.UUID] = None) -> List[Dict[str, Any]]:
    """Retrieve distinct HR users who have created candidate applications."""
    stmt = (
        select(User)
        .join(CandidateApplication, CandidateApplication.created_by_id == User.id)
        .distinct()
    )
    if user_id:
        stmt = stmt.where(CandidateApplication.user_id == user_id)
    stmt = stmt.order_by(User.first_name.asc(), User.last_name.asc())
    users = db.session.execute(stmt).scalars().all()
    return [
        {
            "id": str(u.id),
            "name": u.full_name or u.username or u.email,
            "email": u.email,
        }
        for u in users
    ]


def get_application_by_id(app_id: str | uuid.UUID) -> Optional[CandidateApplication]:
    """Retrieve a single candidate application by primary key."""
    if isinstance(app_id, str):
        try:
            app_id = uuid.UUID(app_id)
        except (ValueError, TypeError):
            return None

    stmt = _base_application_query().where(CandidateApplication.id == app_id)
    return db.session.execute(stmt).scalar_one_or_none()


def get_applications_by_user_id(
    user_id: str | uuid.UUID,
    **filters: Any,
) -> List[CandidateApplication]:
    """Retrieve all applications submitted by a specific user with optional filters."""
    if isinstance(user_id, str):
        try:
            user_id = uuid.UUID(user_id)
        except (ValueError, TypeError):
            return []

    return query_applications(user_id=user_id, **filters)


def list_all_applications(**filters: Any) -> List[CandidateApplication]:
    """Retrieve all candidate applications across the system with optional filters."""
    return query_applications(**filters)


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
