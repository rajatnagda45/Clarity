from __future__ import annotations

import json
from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa


@pytest.mark.asyncio
async def test_rs256_tokens_verify_against_clerk_jwks(client, workspace_id_a):
    from api.middleware import auth as auth_module

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    jwk = jwt.algorithms.RSAAlgorithm.to_jwk(public_key)
    kid = "kid-test-1"
    token = jwt.encode(
        {
            "sub": "user_a",
            "workspace_ids": [workspace_id_a],
            "iss": "https://clerk.dev",
            "aud": "clarity",
        },
        private_key,
        algorithm="RS256",
        headers={"kid": kid},
    )

    with patch.object(auth_module.settings, "clerk_jwks_url", "https://clerk.dev/.well-known/jwks.json"), patch.object(
        auth_module.settings, "clerk_jwt_issuer", "https://clerk.dev"
    ), patch.object(
        auth_module.settings, "clerk_jwt_audience", "clarity"
    ), patch.object(
        auth_module, "_get_jwks_keys", return_value={kid: {**json.loads(jwk), "kid": kid}}
    ), patch.object(
        auth_module, "_jwks_cache", {}
    ):
        response = await client.get(
            "/api/test/probe",
            headers={"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    assert response.json()["user_id"] == "user_a"
