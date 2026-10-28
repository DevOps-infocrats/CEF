import logging
from sqlalchemy import inspect, text
from app.extensions import db

logger = logging.getLogger(__name__)

_schema_verified = False


def ensure_candidate_schema(force: bool = False) -> None:
    """
    Ensure candidate_applications and related tables are completely synchronized with the model.
    Runs idempotently on both PostgreSQL and SQLite.
    Prevents 'column created_by_id does not exist' and NOT NULL constraint violations
    when migrations have not been applied manually to local or production databases.
    """
    global _schema_verified
    if _schema_verified and not force:
        return

    try:
        # 1. Ensure all tables exist in database (creates any new missing tables like candidate_application_districts)
        try:
            db.create_all()
        except Exception as create_err:
            logger.warning(f"db.create_all() notice: {create_err}")

        inspector = inspect(db.engine)
        if not inspector.has_table("candidate_applications"):
            return

        columns = {col["name"]: col for col in inspector.get_columns("candidate_applications")}
        dialect_name = db.engine.dialect.name

        with db.engine.connect() as conn:
            # 2. Ensure created_by_id column exists
            if "created_by_id" not in columns:
                if dialect_name == "postgresql":
                    try:
                        conn.execute(
                            text("ALTER TABLE candidate_applications ADD COLUMN IF NOT EXISTS created_by_id UUID;")
                        )
                        conn.execute(
                            text("CREATE INDEX IF NOT EXISTS ix_candidate_applications_created_by_id ON candidate_applications(created_by_id);")
                        )
                        conn.commit()
                        logger.info("Auto-migrated: Added 'created_by_id' column to candidate_applications.")
                    except Exception as col_err:
                        logger.warning(f"Could not add created_by_id: {col_err}")
                elif dialect_name == "sqlite":
                    try:
                        conn.execute(text("ALTER TABLE candidate_applications ADD COLUMN created_by_id CHAR(32);"))
                        conn.commit()
                    except Exception as col_err:
                        logger.warning(f"Could not add created_by_id (sqlite): {col_err}")

            # 3. Ensure other columns exist if table was created from an older revision
            columns_to_ensure = [
                ("reviewed_by_id", "UUID", "CHAR(32)"),
                ("reviewed_at", "TIMESTAMP WITH TIME ZONE", "DATETIME"),
                ("rejection_reason", "VARCHAR(1000)", "VARCHAR(1000)"),
                ("offer_accepted_at", "TIMESTAMP WITH TIME ZONE", "DATETIME"),
                ("offer_accepted_by_id", "UUID", "CHAR(32)"),
                ("offer_acceptance_status", "VARCHAR(50)", "VARCHAR(50)"),
                ("joining_date", "VARCHAR(50)", "VARCHAR(50)"),
                ("is_permanent_same", "BOOLEAN DEFAULT FALSE", "BOOLEAN DEFAULT 0"),
                ("current_address_line2", "VARCHAR(255)", "VARCHAR(255)"),
                ("permanent_address_line2", "VARCHAR(255)", "VARCHAR(255)"),
                ("branch_name", "VARCHAR(150)", "VARCHAR(150)"),
                ("circle", "VARCHAR(100)", "VARCHAR(100)"),
                ("district", "VARCHAR(500)", "VARCHAR(500)"),
                ("block", "VARCHAR(1000)", "VARCHAR(1000)"),
                ("current_salary", "NUMERIC(12, 2)", "NUMERIC(12, 2)"),
                ("asking_salary", "NUMERIC(12, 2)", "NUMERIC(12, 2)"),
                ("negotiated_salary", "NUMERIC(12, 2)", "NUMERIC(12, 2)"),
            ]
            for col_name, pg_type, sqlite_type in columns_to_ensure:
                if col_name not in columns:
                    try:
                        if dialect_name == "postgresql":
                            conn.execute(
                                text(f"ALTER TABLE candidate_applications ADD COLUMN IF NOT EXISTS {col_name} {pg_type};")
                            )
                            conn.commit()
                        elif dialect_name == "sqlite":
                            conn.execute(
                                text(f"ALTER TABLE candidate_applications ADD COLUMN {col_name} {sqlite_type};")
                            )
                            conn.commit()
                        logger.info(f"Auto-migrated: Added '{col_name}' column to candidate_applications.")
                    except Exception as col_err:
                        logger.warning(f"Could not add column '{col_name}': {col_err}")

            # 4. In PostgreSQL, drop NOT NULL constraints on all candidate form fields that were made optional
            if dialect_name == "postgresql":
                optional_cols = [
                    "hero_category",
                    "role_applied",
                    "full_name",
                    "mobile_number",
                    "email",
                    "aadhaar_number",
                    "pan_number",
                    "current_address_line1",
                    "current_address_line2",
                    "current_city",
                    "current_state",
                    "current_pincode",
                    "current_country",
                    "is_permanent_same",
                    "permanent_address_line1",
                    "permanent_address_line2",
                    "permanent_city",
                    "permanent_state",
                    "permanent_pincode",
                    "permanent_country",
                    "account_holder_name",
                    "bank_name",
                    "account_number",
                    "ifsc_code",
                    "branch_name",
                    "circle",
                    "district",
                    "block",
                    "current_salary",
                    "asking_salary",
                    "negotiated_salary",
                    "joining_date",
                    "reviewed_by_id",
                    "reviewed_at",
                    "rejection_reason",
                    "offer_accepted_at",
                    "offer_accepted_by_id",
                    "offer_acceptance_status",
                ]
                for col_name in optional_cols:
                    col_meta = columns.get(col_name)
                    # If column exists and is marked NOT NULL, drop the constraint
                    if col_meta and not col_meta.get("nullable", True):
                        try:
                            conn.execute(
                                text(f'ALTER TABLE candidate_applications ALTER COLUMN "{col_name}" DROP NOT NULL;')
                            )
                            conn.commit()
                        except Exception as drop_err:
                            logger.warning(f"Could not drop NOT NULL on {col_name}: {drop_err}")
                logger.info("Auto-migrated: Verified all optional candidate columns have nullable constraints.")

                # 5. Safely add foreign key constraint if missing
                try:
                    conn.execute(text("""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (
                                SELECT 1 FROM pg_constraint WHERE conname = 'fk_candidate_applications_created_by_id'
                            ) THEN
                                ALTER TABLE candidate_applications
                                ADD CONSTRAINT fk_candidate_applications_created_by_id
                                FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL;
                            END IF;
                        END $$;
                    """))
                    conn.commit()
                except Exception as fk_err:
                    logger.warning(f"Foreign key check skipped: {fk_err}")

        _schema_verified = True
    except Exception as e:
        logger.warning(f"Schema self-maintenance notice: {e}")
