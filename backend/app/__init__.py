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
        expose_headers=["Content-Disposition"],
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

    app.url_map.strict_slashes = False

    register_error_handlers(app)
    app.register_blueprint(auth_bp)
    app.register_blueprint(candidates_bp)
    app.register_blueprint(candidates_bp, name="candidates_legacy", url_prefix="/api/v1/candidates")
    app.register_blueprint(locations_bp)
    app.register_blueprint(letters_bp)

    @app.route("/", methods=["GET"])
    def root_index():
        """Root endpoint: serve frontend index.html if present, else return API gateway metadata."""
        import os
        from flask import send_file
        candidate_paths = [
            os.path.abspath(os.path.join(app.root_path, "..", "..", "frontend", "dist", "index.html")),
            os.path.abspath(os.path.join(app.root_path, "..", "frontend", "dist", "index.html")),
            os.path.abspath(os.path.join(app.root_path, "static", "index.html")),
            "/usr/share/nginx/html/index.html",
        ]
        for p in candidate_paths:
            if os.path.isfile(p):
                return send_file(p)

        return jsonify(
            {
                "service": "candidate-enrollment-portal-api",
                "status": "healthy",
                "version": "1.0.0",
                "environment": app.config.get("ENV", "unknown"),
                "message": "CEF Portal Backend API is active and operational.",
                "endpoints": {
                    "health": "/health",
                    "api_health": "/api/v1/health",
                    "api_v1": "/api/v1",
                },
            }
        ), 200

    @app.route("/api", methods=["GET"])
    @app.route("/api/", methods=["GET"])
    @app.route("/api/v1", methods=["GET"])
    @app.route("/api/v1/", methods=["GET"])
    def api_root():
        """API base discovery endpoint."""
        return jsonify(
            {
                "service": "candidate-enrollment-portal-api",
                "status": "healthy",
                "version": "1.0.0",
                "environment": app.config.get("ENV", "unknown"),
                "message": "CEF Portal REST API v1 is active and accessible.",
                "health": "/api/v1/health",
            }
        ), 200

    @app.route("/health", methods=["GET"])
    @app.route("/api/health", methods=["GET"])
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
            from app.modules.candidates.schema_maintenance import ensure_candidate_schema
            ensure_candidate_schema()
        except Exception as e:
            app.logger.warning(f"Candidate schema synchronization deferred: {e}")

        try:
            from app.modules.letters.services import LetterTemplateService
            LetterTemplateService.ensure_default_templates()
        except Exception as e:
            app.logger.warning(f"Default templates initialization deferred: {e}")

    return app

