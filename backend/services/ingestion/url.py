from __future__ import annotations

from pydantic import BaseModel, HttpUrl


class UrlIngestionRequest(BaseModel):
    url: HttpUrl


class UrlIngestionNotImplementedError(NotImplementedError):
    pass


def validate_url_ingestion_request(payload: dict) -> UrlIngestionRequest:
    return UrlIngestionRequest.model_validate(payload)


def enqueue_url_ingestion(_: UrlIngestionRequest) -> None:
    raise UrlIngestionNotImplementedError(
        "URL ingestion architecture is defined, but implementation starts in a later milestone."
    )
