import os
import sys

# Ensure backend path is on sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app
from app.extensions import db
from app.modules.locations.importer import import_location_excel
from app.modules.locations.models import LocationState, LocationDistrict, LocationBlock

EXCEL_PATH = r"C:\Users\Mayank Office\Downloads\Rajasthan_Districts_and_Blocks.xlsx"


def seed_rajasthan_locations():
    app = create_app()
    with app.app_context():
        print("Ensuring database tables exist...")
        db.create_all()

        if not os.path.exists(EXCEL_PATH):
            print(f"Warning: Excel file not found at {EXCEL_PATH}")
            return

        print(f"Importing Rajasthan Location Master from {EXCEL_PATH}...")
        res = import_location_excel(
            file_bytes_or_path=EXCEL_PATH,
            state_name="Rajasthan",
            state_code="RJ",
            dry_run=False,
        )
        print("Import Results:")
        print(f"  State: {res['state']} (ID: {res.get('state_id')})")
        print(f"  Total Districts: {res['total_districts']}")
        print(f"  Total Blocks: {res['total_blocks']}")
        print(f"  Created Districts: {res['created_districts']}")
        print(f"  Skipped Districts (Already Existed): {res['skipped_districts']}")
        print(f"  Created Blocks: {res['created_blocks']}")
        print(f"  Skipped Blocks (Already Existed): {res['skipped_blocks']}")
        print(f"  Invalid / Errors: {res['invalid_records']}")
        if res['errors']:
            print(f"  Warnings/Errors: {res['errors']}")

        # Verify counts in DB
        state = LocationState.query.filter_by(name="Rajasthan").first()
        if state:
            d_count = LocationDistrict.query.filter_by(state_id=state.id).count()
            b_count = (
                LocationBlock.query.join(LocationDistrict)
                .filter(LocationDistrict.state_id == state.id)
                .count()
            )
            print(f"Database Verification -> State: {state.name}, Districts: {d_count}, Blocks: {b_count}")


if __name__ == "__main__":
    seed_rajasthan_locations()
