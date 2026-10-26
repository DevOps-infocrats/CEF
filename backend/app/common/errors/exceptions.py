from typing import Any, Optional


class AppException(Exception):
    """Base application exception."""

    def __init__(
        self,
        message: str = "Internal application error",
        status_code: int = 500,
        error_code: str = "INTERNAL_SERVER_ERROR",
        errors: Optional[Any] = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.errors = errors


class ValidationError(AppException):
    def __init__(self, message: str = "Validation failed", errors: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=400,
            error_code="VALIDATION_ERROR",
            errors=errors,
        )


class AuthenticationError(AppException):
    def __init__(self, message: str = "Authentication failed", errors: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=401,
            error_code="AUTHENTICATION_FAILED",
            errors=errors,
        )


class ForbiddenError(AppException):
    def __init__(self, message: str = "Permission denied", errors: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=403,
            error_code="FORBIDDEN",
            errors=errors,
        )


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found", errors: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=404,
            error_code="NOT_FOUND",
            errors=errors,
        )


class ConflictError(AppException):
    def __init__(self, message: str = "Resource conflict", errors: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=409,
            error_code="CONFLICT",
            errors=errors,
        )


class RateLimitExceededError(AppException):
    def __init__(self, message: str = "Rate limit exceeded. Please try again later."):
        super().__init__(
            message=message,
            status_code=429,
            error_code="RATE_LIMIT_EXCEEDED",
        )
