from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import JSONResponse


def error_payload(code: str, message: str) -> dict[str, dict[str, str]]:
    return {"error": {"code": code, "message": message}}


def api_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def error_response(
    status_code: int,
    code: str,
    message: str,
    *,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=error_payload(code, message), headers=headers)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def _http_exception_handler(_, exc: HTTPException) -> JSONResponse:
        detail = exc.detail
        if isinstance(detail, dict):
            code = str(detail.get("code") or f"http_{exc.status_code}")
            message = str(detail.get("message") or detail.get("detail") or "Request failed.")
        elif isinstance(detail, str):
            code = f"http_{exc.status_code}"
            message = detail
        else:
            code = f"http_{exc.status_code}"
            message = "Request failed."
        return error_response(exc.status_code, code, message, headers=exc.headers)

    @app.exception_handler(Exception)
    async def _unhandled_exception_handler(_, __: Exception) -> JSONResponse:
        return error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "internal_server_error",
            "An unexpected error occurred.",
        )


def message_from_response_body(payload: dict[str, Any]) -> str | None:
    error = payload.get("error")
    if isinstance(error, dict) and isinstance(error.get("message"), str):
        return error["message"]
    return None
