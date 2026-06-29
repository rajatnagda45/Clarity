"""
Clerk JWT verification middleware.

Validates the Bearer token on every request, extracts workspace_id,
and injects both into request.state so route handlers never touch raw headers.

workspace_id is derived from the verified JWT — never from the request body.

RS256 (production Clerk tokens): fetches RSA public key from Clerk's JWKS endpoint
and caches it for the process lifetime. Falls back to HS256 for dev/test environments.
"""

import json
import base64
import logging
import threading
from typing import Callable
import httpx
import jwt as pyjwt
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from config import settings

logger = logging.getLogger(__name__)

# Module-level JWKS cache — populated on first RS256 request, never changes
_jwks_cache: dict[str, str] = {}  # kid → PEM public key
_jwks_lock = threading.Lock()

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
        except Exception as exc:
            # Catch malformed tokens that raise non-JWT errors (e.g. UnicodeDecodeError,
            # JSONDecodeError from _decode_header). Must return a Response here — not re-raise —
            # so the CORS middleware can add headers before the browser sees the error.
            logger.warning("Token decode failed with unexpected error: %s", exc)
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Invalid token format"},
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
    Verifies a Clerk-issued JWT.
    - RS256 (Clerk production): fetches the RSA public key from Clerk JWKS, caches by kid.
    - HS256 (dev/test): uses SUPABASE_JWT_SECRET directly.
    """
    header = _decode_header(token)
    algorithm = header.get("alg", "HS256")

    if algorithm.startswith("RS"):
        kid = header.get("kid", "")
        public_key = _get_jwks_key(kid)
        audience = getattr(settings, "clerk_jwt_audience", "") or None
        issuer = getattr(settings, "clerk_jwt_issuer", "") or None
        return pyjwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_exp": True},
            audience=audience,
            issuer=issuer,
        )
    else:
        return pyjwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_exp": True},
        )


def _get_jwks_keys(jwks_url: str) -> dict:
    """
    Fetch JWKS from the URL and return a dict of kid -> JWK dict.
    Separated so tests can patch this without mocking httpx.
    """
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(jwks_url)
            resp.raise_for_status()
            keys = resp.json().get("keys", [])
    except Exception as exc:
        logger.error("Failed to fetch Clerk JWKS from %s: %s", jwks_url, exc)
        raise pyjwt.PyJWTError(f"JWKS fetch failed: {exc}") from exc
    return {key_data.get("kid", ""): key_data for key_data in keys}


def _get_jwks_key(kid: str) -> str:
    """Fetch and cache the RSA public key for the given kid from Clerk's JWKS endpoint."""
    with _jwks_lock:
        if kid in _jwks_cache:
            return _jwks_cache[kid]

    jwks_url = getattr(settings, "clerk_jwks_url", "") or _infer_jwks_url()
    key_dict = _get_jwks_keys(jwks_url)

    from jwt.algorithms import RSAAlgorithm
    for key_kid, key_data in key_dict.items():
        public_key = RSAAlgorithm.from_jwk(json.dumps(key_data))
        with _jwks_lock:
            _jwks_cache[key_kid] = public_key  # type: ignore[assignment]

    with _jwks_lock:
        if kid in _jwks_cache:
            return _jwks_cache[kid]  # type: ignore[return-value]

    raise pyjwt.PyJWTError(f"No JWKS key found for kid={kid!r}")


def _infer_jwks_url() -> str:
    """
    Infer the Clerk JWKS URL from CLERK_SECRET_KEY.
    Clerk secret keys follow the pattern sk_live_<base64-encoded-domain>.
    Falls back to a well-known URL if inference fails.
    """
    try:
        key = settings.clerk_secret_key
        if key.startswith(("sk_live_", "sk_test_")):
            encoded = key.split("_", 2)[2]
            padding = "=" * (4 - len(encoded) % 4)
            domain = base64.b64decode(encoded + padding).decode().rstrip("\x00").rstrip("$")
            return f"https://{domain}/.well-known/jwks.json"
    except Exception:
        pass
    return "https://clerk.com/.well-known/jwks.json"


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
