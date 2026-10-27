from flask import Flask, jsonify
from app.config import get_config
from app.extensions import db, migrate, jwt, limiter, cors, talisman
from app.common.errors.handlers import register_error_handlers
from app.common.logging import configure_logging
from app.modules.auth.routes import auth_bp
from app.modules.auth import models as auth_models
from app.modules.candidates.routes import candidates_bp
from app.modules.candidates import models as candidate_models
from app.modules.locations.routes import locations_bp
from app.modules.locations import models as location_models
from app.modules.letters.routes import letters_bp
from app.modules.letters import models as letter_models


def create_app(config_class=None) -> Flask:
    """Application factory for Candidate Enrollment Form (CEF) Portal."""
    app = Flask(__name__)

    if config_class is None:
        config_class = get_config()
    app.config.from_object(config_class)

    configure_logging(app)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)

    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config.get("CORS_ORIGINS", ["*"])}},
        supports_credentials=True,
    )

    is_prod = app.config.get("ENV") == "production"
    if is_prod:
        if app.config.get("SECRET_KEY") in ("insecure-dev-secret-key-change-me", "", None):
            raise ValueError("Production requires a securely configured SECRET_KEY environment variable.")
        if app.config.get("JWT_SECRET_KEY") in ("insecure-jwt-secret-key-change-me", "", None):
            raise ValueError("Production requires a securely configured JWT_SECRET_KEY environment variable.")

    talisman.init_app(
        app,
        force_https=is_prod,
        content_security_policy=None,
        session_cookie_secure=is_prod,
    )

    register_error_handlers(app)
    app.register_blueprint(auth_bp)
    app.register_blueprint(candidates_bp)
    app.register_blueprint(locations_bp)
    app.register_blueprint(letters_bp)

    @app.route("/api/v1/health", methods=["GET"])
    def health_check():
        return jsonify(
            {
                "status": "healthy",
                "service": "candidate-enrollment-portal-api",
                "environment": app.config.get("ENV", "unknown"),
            }
        ), 200

    with app.app_context():
        from app.modules.auth.permissions import ensure_system_permissions
        ensure_system_permissions()

        try:
            from app.modules.letters.services import LetterTemplateService
            LetterTemplateService.ensure_default_templates()
        except Exception as e:
            app.logger.warning(f"Default templates initialization deferred: {e}")

    return app

