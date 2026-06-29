"""
Clerk JWT verification middleware.

Validates the Bearer token on every request, extracts workspace_id,
and injects both into request.state so route handlers never touch raw headers.

workspace_id is derived from the verified JWT — never from the request body.
"""

from __future__ import annotations

import base64
import json
import time
from typing import Any, Callable

import httpx
import jwt as pyjwt
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from api.errors import error_response, api_error
from config import settings

# Paths that don't require authentication
_PUBLIC_PATHS = {"/", "/health", "/api/health", "/docs", "/openapi.json", "/redoc"}
_JWKS_CACHE_TTL_SECONDS = 300
_jwks_cache: dict[str, Any] = {"keys": {}, "expires_at": 0.0}


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable):
        if request.url.path in _PUBLIC_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return error_response(401, "missing_authorization_header", "Missing or malformed Authorization header.")

        token = auth_header.removeprefix("Bearer ").strip()
        try:
            payload = await _verify_clerk_token(token)
        except pyjwt.ExpiredSignatureError:
            return error_response(401, "token_expired", "Token expired.")
        except pyjwt.PyJWTError as exc:
            return error_response(401, "invalid_token", f"Invalid token: {exc}")
        except httpx.HTTPError:
            return error_response(503, "jwks_unavailable", "Unable to verify Clerk JWT right now.")

        workspace_ids: list[str] = payload.get("workspace_ids", [])
        user_id: str = payload.get("sub", "")

        if not user_id:
            return error_response(401, "missing_sub_claim", "Token missing sub claim.")

        request.state.user_id = user_id
        request.state.workspace_ids = workspace_ids

        requested_ws = request.headers.get("X-Workspace-Id", "")
        if requested_ws and requested_ws not in workspace_ids:
            return error_response(403, "workspace_not_in_token", "Workspace not in token claims.")
        request.state.workspace_id = requested_ws or (workspace_ids[0] if workspace_ids else "")

        return await call_next(request)


async def _verify_clerk_token(token: str) -> dict[str, Any]:
    header = _decode_header(token)
    algorithm = header.get("alg", "HS256")

    if algorithm.startswith("RS"):
        key = await _resolve_jwks_public_key(header.get("kid"))
        decode_kwargs: dict[str, Any] = {
            "algorithms": [algorithm],
            "issuer": settings.clerk_jwt_issuer or None,
            "options": {
                "verify_exp": True,
                "verify_iss": bool(settings.clerk_jwt_issuer),
                "verify_aud": bool(settings.clerk_jwt_audience),
            },
        }
        if settings.clerk_jwt_audience:
            decode_kwargs["audience"] = settings.clerk_jwt_audience
        return pyjwt.decode(token, key=key, **decode_kwargs)

    return pyjwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        options={"verify_exp": True},
    )


async def _resolve_jwks_public_key(kid: str | None) -> Any:
    keys = await _get_jwks_keys(force_refresh=False)
    key_data = keys.get(kid or "")
    if key_data is None:
        keys = await _get_jwks_keys(force_refresh=True)
        key_data = keys.get(kid or "")
    if key_data is None:
        raise pyjwt.PyJWTError("No matching Clerk JWKS key found for token.")
    return pyjwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))


async def _get_jwks_keys(*, force_refresh: bool) -> dict[str, dict[str, Any]]:
    now = time.time()
    if not force_refresh and _jwks_cache["keys"] and _jwks_cache["expires_at"] > now:
        return _jwks_cache["keys"]

    async with httpx.AsyncClient(timeout=2.0) as client:
        response = await client.get(settings.clerk_jwks_url)
        response.raise_for_status()
        payload = response.json()

    keys = {
        str(key.get("kid")): key
        for key in payload.get("keys", [])
        if isinstance(key, dict) and key.get("kid")
    }
    _jwks_cache["keys"] = keys
    _jwks_cache["expires_at"] = now + _JWKS_CACHE_TTL_SECONDS
    return keys


def _decode_header(token: str) -> dict[str, Any]:
    header_segment = token.split(".")[0]
    padding = "=" * (-len(header_segment) % 4)
    decoded = base64.urlsafe_b64decode(header_segment + padding)
    return json.loads(decoded)


def require_workspace(request: Request) -> str:
    workspace_id: str = getattr(request.state, "workspace_id", "")
    if not workspace_id:
        raise api_error(
            403,
            "workspace_header_required",
            "X-Workspace-Id header required when user belongs to multiple workspaces.",
        )
    return workspace_id
