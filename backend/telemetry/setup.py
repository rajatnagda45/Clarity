"""
OpenTelemetry instrumentation setup.

Enabled only when OTEL_ENABLED=true in config. Exports traces via OTLP
(gRPC) to the endpoint configured in OTEL_EXPORTER_OTLP_ENDPOINT.

When disabled (default), this module is a no-op so no OTel packages
are required at runtime unless the feature is turned on.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def setup_telemetry(app: Any, service_name: str, otlp_endpoint: str) -> None:
    """
    Instrument FastAPI + httpx with OpenTelemetry tracing.
    Silently skips if the opentelemetry packages are not installed.
    """
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource, SERVICE_NAME
    except ImportError:
        logger.info("opentelemetry-sdk not installed — tracing disabled")
        return

    resource = Resource.create({SERVICE_NAME: service_name})
    provider = TracerProvider(resource=resource)

    if otlp_endpoint:
        try:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
            exporter = OTLPSpanExporter(endpoint=otlp_endpoint, insecure=True)
            provider.add_span_processor(BatchSpanProcessor(exporter))
            logger.info("OTel OTLP exporter configured → %s", otlp_endpoint)
        except ImportError:
            logger.warning("opentelemetry-exporter-otlp-proto-grpc not installed")

    trace.set_tracer_provider(provider)

    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        FastAPIInstrumentor.instrument_app(app)
        logger.info("FastAPI instrumented with OpenTelemetry")
    except ImportError:
        logger.warning("opentelemetry-instrumentation-fastapi not installed")

    try:
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
        HTTPXClientInstrumentor().instrument()
        logger.info("httpx instrumented with OpenTelemetry")
    except ImportError:
        pass


def get_tracer(name: str = "clarity") -> Any:
    """Return a tracer for manual spans. Returns a no-op tracer if OTel not set up."""
    try:
        from opentelemetry import trace
        return trace.get_tracer(name)
    except ImportError:
        return _NoopTracer()


class _NoopTracer:
    """Minimal no-op tracer so callers don't need try/except."""

    def start_as_current_span(self, name: str, **kwargs):
        import contextlib
        return contextlib.nullcontext()

    def start_span(self, name: str, **kwargs):
        return _NoopSpan()


class _NoopSpan:
    def set_attribute(self, *a, **kw): pass
    def record_exception(self, *a, **kw): pass
    def set_status(self, *a, **kw): pass
    def __enter__(self): return self
    def __exit__(self, *a): pass
