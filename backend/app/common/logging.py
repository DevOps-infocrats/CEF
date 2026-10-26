import os
import logging
import sys
from flask import Flask


def configure_logging(app: Flask) -> None:
    """Configure standardized application logger."""
    log_level = logging.DEBUG if app.config.get("DEBUG") else logging.INFO

    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(name)s:%(lineno)d] %(message)s"
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    handler.setLevel(log_level)

    app.logger.setLevel(log_level)
    if not app.logger.handlers:
        app.logger.addHandler(handler)

    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    sql_echo = os.getenv("SQL_ECHO", "").lower() in ("true", "1")
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if sql_echo else logging.WARNING
    )
