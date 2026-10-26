# Candidate Enrollment Form (CEF) Portal Permissions & Roles

# Role Identifiers
ROLE_SUPER_ADMIN = "admin"
ROLE_OFFICER = "reviewer"
ROLE_APPLICANT = "candidate"
ROLE_AUDITOR = "auditor"

ALL_ROLES = [
    ROLE_SUPER_ADMIN,
    ROLE_OFFICER,
    ROLE_APPLICANT,
    ROLE_AUDITOR,
]

# Granular Permission Scopes / Identifiers
SCOPE_PORTAL_ACCESS = "portal:access"
SCOPE_AUTH_READ = "auth:read"
SCOPE_AUTH_WRITE = "auth:write"
SCOPE_USERS_MANAGE = "users:manage"
SCOPE_CANDIDATES_READ = "candidates:read"
SCOPE_CANDIDATES_WRITE = "candidates:write"
SCOPE_CANDIDATES_CREATE = "candidates:create"
SCOPE_CANDIDATES_EDIT = "candidates:edit"
SCOPE_CANDIDATES_SUBMIT = "candidates:submit"
SCOPE_CANDIDATES_REVIEW = "candidates:review"
SCOPE_DOCUMENTS_VIEW = "documents:view"
SCOPE_DOCUMENTS_VERIFY = "documents:verify"
SCOPE_DOCUMENTS_BULK_VERIFY = "documents:bulk_verify"
SCOPE_CANDIDATES_APPROVE = "candidates:approve"
SCOPE_CANDIDATES_REJECT = "candidates:reject"
SCOPE_ENROLLMENT_MANAGE = "enrollment:manage"
SCOPE_AUDIT_READ = "audit:read"

# Full catalog of system permissions with UI presentation details
SYSTEM_PERMISSIONS = [
    {
        "code": SCOPE_PORTAL_ACCESS,
        "name": "Portal Access",
        "category": "General",
        "description": "Log in and access basic portal profile and candidate overview.",
    },
    {
        "code": SCOPE_CANDIDATES_READ,
        "name": "View Candidates",
        "category": "Candidate Management",
        "description": "View authorized candidate applications and summary lists.",
    },
    {
        "code": SCOPE_CANDIDATES_CREATE,
        "name": "Create Applications",
        "category": "Candidate Management",
        "description": "Enter and start new candidate enrollment records.",
    },
    {
        "code": SCOPE_CANDIDATES_EDIT,
        "name": "Edit Candidate Details",
        "category": "Candidate Management",
        "description": "Edit candidate personal, contact, and bank details where permitted.",
    },
    {
        "code": SCOPE_CANDIDATES_SUBMIT,
        "name": "Submit Applications",
        "category": "Candidate Management",
        "description": "Submit completed candidate enrollment forms for verification.",
    },
    {
        "code": SCOPE_DOCUMENTS_VIEW,
        "name": "View Documents",
        "category": "Document Verification",
        "description": "Access, download, and review uploaded candidate supporting files.",
    },
    {
        "code": SCOPE_DOCUMENTS_VERIFY,
        "name": "Verify Checklist Items",
        "category": "Document Verification",
        "description": "Complete and reset individual checklist verification items.",
    },
    {
        "code": SCOPE_DOCUMENTS_BULK_VERIFY,
        "name": "Bulk Verify Documents",
        "category": "Document Verification",
        "description": "Mark all uploaded candidate documents as verified in one action.",
    },
    {
        "code": SCOPE_CANDIDATES_APPROVE,
        "name": "Approve Candidates",
        "category": "Decisions",
        "description": "Issue final candidate approval when required verification is complete.",
    },
    {
        "code": SCOPE_CANDIDATES_REJECT,
        "name": "Reject Candidates",
        "category": "Decisions",
        "description": "Issue candidate rejection with recorded mandatory reason.",
    },
    {
        "code": SCOPE_USERS_MANAGE,
        "name": "Manage Users & Permissions",
        "category": "Administration",
        "description": "Create portal login accounts, assign permissions, and activate/deactivate users.",
    },
    {
        "code": SCOPE_AUDIT_READ,
        "name": "View Audit & Activity Logs",
        "category": "Administration",
        "description": "Inspect compliance trails, authentication events, and verification logs.",
    },
]

# Reusable permission presets
PERMISSION_PRESETS = [
    {
        "id": "data_entry",
        "name": "Data Entry Specialist",
        "description": "Create and edit candidate applications without verification or decision authority.",
        "permissions": [
            SCOPE_PORTAL_ACCESS,
            SCOPE_AUTH_READ,
            SCOPE_CANDIDATES_READ,
            SCOPE_CANDIDATES_CREATE,
            SCOPE_CANDIDATES_EDIT,
            SCOPE_CANDIDATES_SUBMIT,
            SCOPE_CANDIDATES_WRITE,
        ],
    },
    {
        "id": "reviewer",
        "name": "Document Verification Officer",
        "description": "Review candidate details and complete checklist verifications without approval authority.",
        "permissions": [
            SCOPE_PORTAL_ACCESS,
            SCOPE_AUTH_READ,
            SCOPE_CANDIDATES_READ,
            SCOPE_CANDIDATES_REVIEW,
            SCOPE_DOCUMENTS_VIEW,
            SCOPE_DOCUMENTS_VERIFY,
            SCOPE_DOCUMENTS_BULK_VERIFY,
        ],
    },
    {
        "id": "approver",
        "name": "Verification & Approval Officer",
        "description": "Full verification with authority to approve candidates.",
        "permissions": [
            SCOPE_PORTAL_ACCESS,
            SCOPE_AUTH_READ,
            SCOPE_CANDIDATES_READ,
            SCOPE_CANDIDATES_REVIEW,
            SCOPE_DOCUMENTS_VIEW,
            SCOPE_DOCUMENTS_VERIFY,
            SCOPE_DOCUMENTS_BULK_VERIFY,
            SCOPE_CANDIDATES_APPROVE,
        ],
    },
    {
        "id": "decision_maker",
        "name": "Senior Reviewer (Approve & Reject)",
        "description": "Complete review authority to both approve and reject candidates.",
        "permissions": [
            SCOPE_PORTAL_ACCESS,
            SCOPE_AUTH_READ,
            SCOPE_CANDIDATES_READ,
            SCOPE_CANDIDATES_REVIEW,
            SCOPE_DOCUMENTS_VIEW,
            SCOPE_DOCUMENTS_VERIFY,
            SCOPE_DOCUMENTS_BULK_VERIFY,
            SCOPE_CANDIDATES_APPROVE,
            SCOPE_CANDIDATES_REJECT,
        ],
    },
    {
        "id": "admin",
        "name": "System Administrator",
        "description": "Complete portal access, candidate operations, user creation, and permission management.",
        "permissions": [p["code"] for p in SYSTEM_PERMISSIONS] + [
            SCOPE_AUTH_WRITE,
            SCOPE_CANDIDATES_WRITE,
            SCOPE_CANDIDATES_REVIEW,
            SCOPE_ENROLLMENT_MANAGE,
        ],
    },
]

# Legacy / default role mappings (used when user has no explicit user_permissions records)
ROLE_PERMISSIONS = {
    ROLE_SUPER_ADMIN: [p["code"] for p in SYSTEM_PERMISSIONS] + [
        SCOPE_AUTH_WRITE,
        SCOPE_CANDIDATES_WRITE,
        SCOPE_CANDIDATES_REVIEW,
        SCOPE_ENROLLMENT_MANAGE,
    ],
    ROLE_OFFICER: [
        SCOPE_PORTAL_ACCESS,
        SCOPE_AUTH_READ,
        SCOPE_CANDIDATES_READ,
        SCOPE_CANDIDATES_REVIEW,
        SCOPE_DOCUMENTS_VIEW,
        SCOPE_DOCUMENTS_VERIFY,
        SCOPE_DOCUMENTS_BULK_VERIFY,
        SCOPE_CANDIDATES_APPROVE,
        SCOPE_CANDIDATES_REJECT,
    ],
    ROLE_APPLICANT: [
        SCOPE_PORTAL_ACCESS,
        SCOPE_AUTH_READ,
        SCOPE_CANDIDATES_READ,
        SCOPE_CANDIDATES_CREATE,
        SCOPE_CANDIDATES_EDIT,
        SCOPE_CANDIDATES_SUBMIT,
        SCOPE_CANDIDATES_WRITE,
    ],
    ROLE_AUDITOR: [
        SCOPE_PORTAL_ACCESS,
        SCOPE_AUTH_READ,
        SCOPE_AUDIT_READ,
        SCOPE_CANDIDATES_READ,
    ],
}


def get_default_permissions_for_roles(roles: list[str]) -> set[str]:
    """Retrieve fallback permission scopes for role names."""
    perms = set()
    for role in roles:
        perms.update(ROLE_PERMISSIONS.get(role, []))
    return perms


def ensure_system_permissions() -> None:
    """Ensure all dynamic permissions exist in the database."""
    from app.extensions import db
    from app.modules.auth.models import Permission, User, UserPermission, Role

    try:
        db.create_all()

        existing_perms = {p.code: p for p in db.session.query(Permission).all()}
        for item in SYSTEM_PERMISSIONS:
            if item["code"] not in existing_perms:
                perm = Permission(
                    code=item["code"],
                    name=item["name"],
                    category=item["category"],
                    description=item.get("description"),
                )
                db.session.add(perm)

        db.session.commit()
    except Exception:
        db.session.rollback()
