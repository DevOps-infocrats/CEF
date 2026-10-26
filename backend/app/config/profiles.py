import os
from app.config.base import BaseConfig


class DevelopmentConfig(BaseConfig):
    """Development configuration profile."""

    DEBUG = True
    ENV = "development"
    JWT_COOKIE_SECURE = False
    JWT_COOKIE_CSRF_PROTECT = False
    JWT_COOKIE_SAMESITE = "Lax"


class TestingConfig(BaseConfig):
    """Testing configuration profile using SQLite or dedicated test DB."""

    TESTING = True
    DEBUG = False
    ENV = "testing"
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "TEST_DATABASE_URL",
        "sqlite:///:memory:",
    )
    SQLALCHEMY_ENGINE_OPTIONS = {}
    JWT_COOKIE_SECURE = False
    JWT_COOKIE_CSRF_PROTECT = False
    RATELIMIT_ENABLED = False


class ProductionConfig(BaseConfig):
    """Production configuration profile with reinforced security."""

    DEBUG = False
    TESTING = False
    ENV = "production"
    JWT_COOKIE_SECURE = True
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_COOKIE_SAMESITE = "Strict"
