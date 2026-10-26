import pytest
from app import create_app
from app.config.profiles import TestingConfig
from app.extensions import db
from app.modules.auth.models import Role
from app.modules.auth.permissions import ALL_ROLES, ensure_system_permissions


@pytest.fixture(scope="session")
def app():
    """Create test application context."""
    app = create_app(config_class=TestingConfig)
    with app.app_context():
        db.create_all()

        for r_name in ALL_ROLES:
            if not Role.query.filter_by(name=r_name).first():
                db.session.add(Role(name=r_name, description=f"Test {r_name}"))
        ensure_system_permissions()
        db.session.commit()

        yield app

        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Test HTTP client."""
    return app.test_client()


@pytest.fixture(autouse=True)
def clean_db(app):
    """Clean up user data between test runs while retaining roles and permissions."""
    yield
    with app.app_context():
        from app.modules.auth.models import User, RefreshToken, AuditLog, UserRole, UserPermission
        from app.modules.candidates.models import (
            CandidateApplication,
            CandidateDocument,
            CandidateVerificationItem,
            CandidateApplicationDistrict,
            CandidateApplicationBlock,
        )
        from app.modules.letters.models import CandidateLetter, DocumentTemplate
        db.session.query(CandidateLetter).delete()
        db.session.query(DocumentTemplate).filter(DocumentTemplate.version > 1).delete()
        for t in db.session.query(DocumentTemplate).filter(DocumentTemplate.version == 1).all():
            t.is_active = True
        db.session.query(CandidateApplicationBlock).delete()
        db.session.query(CandidateApplicationDistrict).delete()
        db.session.query(CandidateVerificationItem).delete()
        db.session.query(CandidateDocument).delete()
        db.session.query(CandidateApplication).delete()
        db.session.query(RefreshToken).delete()
        db.session.query(AuditLog).delete()
        db.session.query(UserPermission).delete()
        db.session.query(UserRole).delete()
        db.session.query(User).delete()
        db.session.commit()

        # Clean up any test files in storage/documents
        import os, shutil
        storage_dir = os.path.join(app.root_path, "..", "storage", "documents")
        if os.path.exists(storage_dir):
            for item in os.listdir(storage_dir):
                item_path = os.path.join(storage_dir, item)
                try:
                    if os.path.isfile(item_path):
                        os.remove(item_path)
                    elif os.path.isdir(item_path):
                        shutil.rmtree(item_path)
                except OSError:
                    pass


@pytest.fixture
def sample_valid_payload():
    return {
        "hero_category": "Hero 1",
        "role_applied": "HDD Operate",
        "full_name": "Rajesh Kumar",
        "mobile_number": "9876543210",
        "email": "rajesh.k@example.org",
        "aadhaar_number": "123456789012",
        "pan_number": "ABCDE1234F",
        "current_address_line1": "Flat 402, Green Enclave",
        "current_city": "Indore",
        "current_state": "Madhya Pradesh",
        "current_pincode": "452001",
        "current_country": "India",
        "is_permanent_same": True,
        "permanent_address_line1": "Flat 402, Green Enclave",
        "permanent_city": "Indore",
        "permanent_state": "Madhya Pradesh",
        "permanent_pincode": "452001",
        "permanent_country": "India",
        "account_holder_name": "Rajesh Kumar",
        "bank_name": "State Bank of India",
        "account_number": "12345678901",
        "confirm_account_number": "12345678901",
        "ifsc_code": "SBIN0001234",
        "branch_name": "Main Branch",
        "circle": "Central Circle",
        "district": "Indore",
        "block": "Block A",
        "current_salary": 35000.0,
        "asking_salary": 45000.0,
        "negotiated_salary": 42000.0,
    }

