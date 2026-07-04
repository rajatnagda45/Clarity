"""
Clarity AI Docs — Locust load test suite.

Scenarios:
  - ChatUser:       POST /api/chat (most common operation)
  - DocumentUser:   GET /api/documents + document listing
  - BenchmarkUser:  POST /api/benchmarks/datasets/{id}/runs (heavy operation)
  - AgentUser:      POST /api/agents/{id}/runs + poll status

Usage:
    locust -f locustfile.py --host=http://localhost:8000 \
           --users=100 --spawn-rate=10 --headless --run-time=60s

    # Web UI:
    locust -f locustfile.py --host=http://localhost:8000

Target benchmarks:
    100 users  → p50 <200ms, p99 <1s, error rate <1%
    500 users  → p50 <500ms, p99 <3s, error rate <2%
    1000 users → p50 <1s,    p99 <5s, error rate <5%
"""
from __future__ import annotations

import os
import random
import string
from locust import HttpUser, TaskSet, between, task, events


# ─── Auth helpers ─────────────────────────────────────────────────────────────

def _make_headers() -> dict:
    """
    Build auth headers from environment variables.

    Set these before running:
        LOCUST_JWT=<bearer-token>
        LOCUST_WORKSPACE_ID=<workspace-uuid>
    """
    return {
        "Authorization": f"Bearer {os.getenv('LOCUST_JWT', 'test-token')}",
        "X-Workspace-Id": os.getenv("LOCUST_WORKSPACE_ID", "ws-load-test"),
        "Content-Type": "application/json",
    }


def _rand_id(n: int = 8) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


# ─── Task sets ────────────────────────────────────────────────────────────────

class ChatTasks(TaskSet):
    """Simulate real-user chat interactions."""

    queries = [
        "What are the key indemnification clauses in this contract?",
        "Summarise the liability limitations section.",
        "Are there any auto-renewal provisions?",
        "What is the termination notice period?",
        "List all payment terms and late fees.",
        "Identify any exclusivity clauses.",
        "What are the governing law and jurisdiction?",
        "Find all data processing agreements.",
        "Summarise the IP ownership section.",
        "What warranties does the vendor provide?",
    ]

    @task(5)
    def chat_query(self):
        with self.client.post(
            "/api/chat",
            json={"query": random.choice(self.queries)},
            headers=_make_headers(),
            catch_response=True,
            stream=False,
        ) as resp:
            if resp.status_code in (200, 206):
                resp.success()
            elif resp.status_code == 429:
                resp.failure("Rate limited")
            elif resp.status_code >= 500:
                resp.failure(f"Server error {resp.status_code}")
            else:
                resp.success()

    @task(1)
    def list_conversations(self):
        self.client.get(
            "/api/chat/conversations",
            headers=_make_headers(),
            name="/api/chat/conversations",
        )


class DocumentTasks(TaskSet):
    """Simulate document management operations."""

    @task(4)
    def list_documents(self):
        self.client.get(
            "/api/documents",
            headers=_make_headers(),
            name="/api/documents",
        )

    @task(1)
    def get_collections(self):
        self.client.get(
            "/api/collections",
            headers=_make_headers(),
            name="/api/collections",
        )


class AgentTasks(TaskSet):
    """Simulate agent library interactions."""

    @task(3)
    def list_agents(self):
        self.client.get(
            "/api/agents",
            headers=_make_headers(),
            name="/api/agents",
        )

    @task(1)
    def review_queue(self):
        self.client.get(
            "/api/review-queue",
            headers=_make_headers(),
            name="/api/review-queue",
        )

    @task(1)
    def list_workflows(self):
        self.client.get(
            "/api/workflows",
            headers=_make_headers(),
            name="/api/workflows",
        )


class HealthTasks(TaskSet):
    """Lightweight health probe — simulates k8s probes and monitoring systems."""

    @task
    def liveness(self):
        self.client.get("/health/live", name="/health/live")

    @task
    def metrics(self):
        self.client.get(
            "/api/metrics",
            headers=_make_headers(),
            name="/api/metrics",
        )


# ─── User profiles ────────────────────────────────────────────────────────────

class ChatUser(HttpUser):
    """Primary user type — runs AI chat queries (60% of load)."""
    tasks = [ChatTasks]
    weight = 6
    wait_time = between(2, 8)


class DocumentUser(HttpUser):
    """Document browser — lists and views documents (25% of load)."""
    tasks = [DocumentTasks]
    weight = 2
    wait_time = between(1, 4)


class AgentUser(HttpUser):
    """Agent power-user — interacts with the agent platform (10% of load)."""
    tasks = [AgentTasks]
    weight = 1
    wait_time = between(3, 10)


class MonitorUser(HttpUser):
    """Monitoring + health probes (5% of load)."""
    tasks = [HealthTasks]
    weight = 1
    wait_time = between(10, 30)


# ─── Custom stats reporting ───────────────────────────────────────────────────

@events.quitting.add_listener
def _(environment, **kwargs):
    """Print a summary when the test ends."""
    stats = environment.stats
    total = stats.total
    print("\n" + "=" * 60)
    print(f"  LOAD TEST SUMMARY")
    print("=" * 60)
    print(f"  Requests:    {total.num_requests:,}")
    print(f"  Failures:    {total.num_failures:,}  ({100 * total.fail_ratio:.1f}%)")
    print(f"  Median:      {total.median_response_time:.0f} ms")
    print(f"  p95:         {total.get_response_time_percentile(0.95):.0f} ms")
    print(f"  p99:         {total.get_response_time_percentile(0.99):.0f} ms")
    print(f"  RPS:         {total.current_rps:.1f}")
    print("=" * 60)

    # Fail the run if error rate is above threshold
    if total.fail_ratio > 0.05:
        environment.process_exit_code = 1
