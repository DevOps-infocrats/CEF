from contextlib import contextmanager
from functools import wraps
from typing import Callable, Generator
from app.extensions import db


@contextmanager
def atomic() -> Generator[None, None, None]:
    """
    Context manager providing atomic database transaction semantics.
    Automatically commits on success and rolls back on exception.
    """
    try:
        yield
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def transactional(func: Callable) -> Callable:
    """Decorator to wrap a function execution inside an atomic database transaction."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        with atomic():
            return func(*args, **kwargs)
    return wrapper
