from typing import Any, Dict, Optional, Tuple
from flask import jsonify, Response


def api_response(
    data: Any = None,
    message: str = "Success",
    status_code: int = 200,
    meta: Optional[Dict[str, Any]] = None,
) -> Tuple[Response, int]:
    """Generate standardized JSON success response envelope."""
    payload: Dict[str, Any] = {
        "success": True,
        "message": message,
        "data": data,
    }
    if meta is not None:
        payload["meta"] = meta
    return jsonify(payload), status_code


def error_response(
    message: str = "An error occurred",
    status_code: int = 400,
    error_code: str = "BAD_REQUEST",
    errors: Optional[Any] = None,
) -> Tuple[Response, int]:
    """Generate standardized JSON error response envelope."""
    payload: Dict[str, Any] = {
        "success": False,
        "message": message,
        "error": {
            "code": error_code,
            "details": errors or [],
        },
    }
    return jsonify(payload), status_code
