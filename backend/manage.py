import sys
import os
from app import create_app

app = create_app()


def main():
    args = sys.argv[1:]
    command = args[0] if args else "runserver"

    if command == "runserver":
        port = int(args[1]) if len(args) > 1 else int(os.getenv("PORT", 5000))
        host = os.getenv("HOST", "0.0.0.0")
        print(f"\n>> Starting Clean Energy Fund (CEF) Portal Backend on http://127.0.0.1:{port}\n")
        app.run(host=host, port=port, debug=app.config.get("DEBUG", True))

    elif command == "migrate":
        from alembic.config import Config
        from alembic import command as alembic_command
        print("\n>> Running database migrations under application context...")
        with app.app_context():
            alembic_cfg = Config("migrations/alembic.ini")
            alembic_command.upgrade(alembic_cfg, "head")
        print(">> Migrations complete!\n")

    elif command == "makemigrations":
        from alembic.config import Config
        from alembic import command as alembic_command
        msg = args[1] if len(args) > 1 else "auto_migration"
        print(f"\n>> Generating migration file: {msg}...")
        with app.app_context():
            alembic_cfg = Config("migrations/alembic.ini")
            alembic_command.revision(alembic_cfg, message=msg, autogenerate=True)

    elif command == "history":
        from alembic.config import Config
        from alembic import command as alembic_command
        with app.app_context():
            alembic_cfg = Config("migrations/alembic.ini")
            alembic_command.history(alembic_cfg)

    elif command == "seed":
        from seed import seed_database
        seed_database()

    elif command == "routes":
        print(f"{'Endpoint':<35} {'Methods':<25} {'Rule':<40}")
        print("-" * 100)
        for rule in app.url_map.iter_rules():
            methods = ",".join(sorted(rule.methods - {"HEAD", "OPTIONS"}))
            print(f"{rule.endpoint:<35} {methods:<25} {rule.rule:<40}")

    else:
        print(f"Unknown command: '{command}'")
        print("Available commands: runserver, migrate, makemigrations, history, seed, routes")
        sys.exit(1)


if __name__ == "__main__":
    main()
