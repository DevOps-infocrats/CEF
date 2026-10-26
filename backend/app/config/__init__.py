import os
from typing import Type
from app.config.base import BaseConfig
from app.config.profiles import DevelopmentConfig, TestingConfig, ProductionConfig

_CONFIG_MAP = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config() -> Type[BaseConfig]:
    """Return appropriate configuration class based on FLASK_ENV."""
    env = os.getenv("FLASK_ENV", "development").lower()
    return _CONFIG_MAP.get(env, DevelopmentConfig)
