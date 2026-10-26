from app import create_app
from app.extensions import db
from app.common.database.transactions import atomic
from app.modules.auth.models import Role, User
from app.modules.auth.permissions import ALL_ROLES, ROLE_SUPER_ADMIN
from app.modules.auth.services import hash_password

app = create_app()

ROLE_DESCRIPTIONS = {
    "admin": "System Administrator with full management of candidate enrollment, users, and audit logs.",
    "reviewer": "Enrollment Officer / Reviewer reviewing candidate applications and verifying documents.",
    "candidate": "Candidate applicant registering and submitting Candidate Enrollment Form.",
    "auditor": "Read-only auditor with access to enrollment reports and audit trails.",
}


def clear_and_seed_database():
    """Drop and recreate all tables, creating ONLY the requested admin user (Admin / admin123)."""
    with app.app_context():
        print("Clearing all existing database tables and data...")
        db.drop_all()
        db.create_all()

        with atomic():
            # Seed Roles
            roles_dict = {}
            for role_name in ALL_ROLES:
                role = Role(
                    name=role_name,
                    description=ROLE_DESCRIPTIONS.get(role_name, f"{role_name} role"),
                )
                db.session.add(role)
                roles_dict[role_name] = role
                print(f"Created role: {role_name}")

            db.session.flush()

            # Create ONLY Admin user
            admin_user = User(
                username="admin",
                email="admin@cef.com",
                password_hash=hash_password("admin123"),
                first_name="System",
                last_name="Admin",
                is_active=True,
                is_verified=True,
            )
            admin_user.roles.append(roles_dict[ROLE_SUPER_ADMIN])
            db.session.add(admin_user)
            print("Successfully created admin user:")
            print("  User ID / Username: Admin (or admin)")
            print("  Email: admin@cef.com")
            print("  Password: admin123")

        print("Database reset and initial seed completed successfully.")


if __name__ == "__main__":
    clear_and_seed_database()
