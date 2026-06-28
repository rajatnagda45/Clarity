"""
Clerk JWT verification middleware.

Validates the Bearer token on every request, extracts workspace_id,
and injects both into request.state so route handlers never touch raw headers.

workspace_id is derived from the verified JWT — never from the request body.
"""

import json
import base64
from typing import Callable
import jwt as pyjwt
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from config import settings

# Paths that don't require authentication
_PUBLIC_PATHS = {"/", "/health", "/api/health", "/docs", "/openapi.json", "/redoc"}


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable):
        if request.url.path in _PUBLIC_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Missing or malformed Authorization header"},
            )

        token = auth_header.removeprefix("Bearer ").strip()
        try:
            payload = _verify_clerk_token(token)
        except pyjwt.ExpiredSignatureError:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Token expired"},
            )
        except pyjwt.PyJWTError as exc:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": f"Invalid token: {exc}"},
            )

        workspace_ids: list[str] = payload.get("workspace_ids", [])
        user_id: str = payload.get("sub", "")

        if not user_id:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Token missing sub claim"},
            )

        request.state.user_id = user_id
        request.state.workspace_ids = workspace_ids
        # Convenience: active workspace from header (validated against token's list)
        requested_ws = request.headers.get("X-Workspace-Id", "")
        if requested_ws and requested_ws not in workspace_ids:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "Workspace not in token claims"},
            )
        request.state.workspace_id = requested_ws or (workspace_ids[0] if workspace_ids else "")

        return await call_next(request)


def _verify_clerk_token(token: str) -> dict:
    """
    Verifies a Clerk-issued JWT using the configured JWT secret.
    Clerk uses RS256 in production; for dev/test, HS256 with SUPABASE_JWT_SECRET is acceptable.
    The key algorithm is determined from the token header.
    """
    header = _decode_header(token)
    algorithm = header.get("alg", "HS256")

    if algorithm.startswith("RS"):
        # RS256: decode with PEM public key (set CLERK_JWT_PUBLIC_KEY in prod)
        public_key = settings.clerk_secret_key
        return pyjwt.decode(token, public_key, algorithms=["RS256"], options={"verify_exp": True})
    else:
        return pyjwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_exp": True},
        )


def _decode_header(token: str) -> dict:
    header_segment = token.split(".")[0]
    padding = "=" * (4 - len(header_segment) % 4)
    decoded = base64.urlsafe_b64decode(header_segment + padding)
    return json.loads(decoded)


def require_workspace(request: Request) -> str:
    """
    FastAPI dependency: returns the validated workspace_id for the current request.
    Raises 403 if no workspace is set (e.g., endpoint called without X-Workspace-Id
    and the user belongs to multiple workspaces).
    """
    workspace_id: str = getattr(request.state, "workspace_id", "")
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="X-Workspace-Id header required when user belongs to multiple workspaces",
        )
    return workspace_id
