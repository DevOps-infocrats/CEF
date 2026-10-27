"""
Bootstrap Admin Script for CEF Portal.
Creates an initial authorized administrator account safely without dropping tables or altering existing schema/data.
Usage:
    python bootstrap_admin.py --email admin@cef.com --password YourSecurePassword
"""
import argparse
import sys
from app import create_app
from app.extensions import db
from app.modules.auth.models import Role, User
from app.modules.auth.permissions import ROLE_SUPER_ADMIN
from app.modules.auth.services import hash_password

def bootstrap_admin(email, password, username="admin", first_name="System", last_name="Admin"):
    app = create_app()
    with app.app_context():
        existing_user = User.query.filter((User.email == email) | (User.username == username)).first()
        if existing_user:
            print(f"User with email '{email}' or username '{username}' already exists (ID: {existing_user.id}).")
            return

        super_admin_role = Role.query.filter_by(name=ROLE_SUPER_ADMIN).first()
        if not super_admin_role:
            print(f"Error: Required role '{ROLE_SUPER_ADMIN}' not found in database.")
            sys.exit(1)

        admin = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            first_name=first_name,
            last_name=last_name,
            is_active=True,
            is_verified=True,
            approval_status="APPROVED",
        )
        admin.roles.append(super_admin_role)
        db.session.add(admin)
        db.session.commit()
        print(f"Successfully bootstrapped administrator account:")
        print(f"  User ID : {admin.id}")
        print(f"  Email   : {admin.email}")
        print(f"  Username: {admin.username}")
        print(f"  Role    : {ROLE_SUPER_ADMIN}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bootstrap Administrator Account")
    parser.add_argument("--email", default="admin@cef.com", help="Admin email address")
    parser.add_argument("--password", default="admin123", help="Admin password")
    parser.add_argument("--username", default="admin", help="Admin username")
    args = parser.parse_args()

    bootstrap_admin(email=args.email, password=args.password, username=args.username)
