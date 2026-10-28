import logging
from flask import Flask
from marshmallow import ValidationError as MarshmallowValidationError
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import HTTPException
from app.common.errors.exceptions import AppException
from app.common.responses import error_response

logger = logging.getLogger(__name__)


def register_error_handlers(app: Flask) -> None:
    """Register application-wide exception and error handlers."""

    @app.errorhandler(AppException)
    def handle_app_exception(e: AppException):
        return error_response(
            message=e.message,
            status_code=e.status_code,
            error_code=e.error_code,
            errors=e.errors,
        )

    @app.errorhandler(MarshmallowValidationError)
    def handle_marshmallow_validation_error(e: MarshmallowValidationError):
        return error_response(
            message="Invalid request payload",
            status_code=400,
            error_code="VALIDATION_ERROR",
            errors=e.messages,
        )

    @app.errorhandler(HTTPException)
    def handle_http_exception(e: HTTPException):
        code = e.code or 500
        error_code = e.name.upper().replace(" ", "_")

        # Fallback for SPA frontend client-side routing if requested directly from backend
        if code == 404:
            from flask import request
            if not request.path.startswith("/api") and request.accept_mimetypes.accept_html:
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

        return error_response(
            message=e.description or "HTTP error occurred",
            status_code=code,
            error_code=error_code,
        )

    @app.errorhandler(SQLAlchemyError)
    def handle_sqlalchemy_error(e: SQLAlchemyError):
        logger.error(f"Database error encountered: {str(e)}", exc_info=True)
        is_dev = app.config.get("DEBUG") or app.config.get("ENV") != "production"
        orig_err = str(getattr(e, "orig", None) or e)
        msg = f"A database error occurred: {orig_err}" if is_dev else "A database error occurred. Please contact support if the issue persists."
        return error_response(
            message=msg,
            status_code=500,
            error_code="DATABASE_ERROR",
            errors={"detail": orig_err} if is_dev else None,
        )

    @app.errorhandler(Exception)
    def handle_generic_exception(e: Exception):
        logger.error(f"Unhandled server exception: {str(e)}", exc_info=True)
        return error_response(
            message="An unexpected server error occurred.",
            status_code=500,
            error_code="INTERNAL_SERVER_ERROR",
        )
