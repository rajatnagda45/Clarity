from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # OpenAI
    openai_api_key: str
    llm_model: str = "gpt-4o-mini"
    embed_model: str = "text-embedding-3-small"
    embed_dim: int = 1536

    # Two-signal verifier
    nli_provider: str = "openai"          # openai | hosted
    nli_model: str = ""                   # DeBERTa/cross-encoder endpoint URL when nli_provider=hosted
    nli_openai_model: str = "gpt-4o"     # OpenAI model for NLI signal — must differ from judge_model to keep signals independent
    abstain_threshold: float = 0.55       # calibrated confidence below which the system abstains
    critic_max_iterations: int = 2        # hard cap on Critic re-retrieval rounds

    # Eval / CI quality gate
    eval_faithfulness_min: float = 0.85
    eval_catch_rate_min: float = 0.80
    eval_golden_path: str = "backend/services/eval/golden/cases"

    # Pinecone
    pinecone_api_key: str
    pinecone_index: str = "clarity"
    pinecone_dim: int = 1536

    # Cohere (optional — only needed for reranking)
    cohere_api_key: str = ""

    # Supabase
    supabase_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    # Clerk
    clerk_secret_key: str
    next_public_clerk_publishable_key: str = ""
    clerk_jwks_url: str = ""  # override JWKS URL; auto-derived from clerk_secret_key if blank
    clerk_jwt_issuer: str = ""  # optional issuer claim check (legacy compat)
    clerk_jwt_audience: str = ""  # optional audience claim check (legacy compat)
    developer_user_ids: str = ""  # comma-separated user IDs (legacy compat); parse with .split(",") if needed

    # Upstash Redis (optional — legacy REST-based rate limiting; prefer REDIS_URL)
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""

    # Redis (standard redis:// URL — used for queue, cache, and rate limiting)
    redis_url: str = ""

    # ARQ job queue settings
    arq_job_timeout: int = 3600        # max seconds a single job may run
    arq_max_jobs: int = 10             # concurrent jobs per worker
    arq_max_tries: int = 3             # retry attempts before dead-letter
    arq_keep_result: int = 86400       # seconds to keep job results in Redis

    # OpenTelemetry
    otel_enabled: bool = False
    otel_service_name: str = "clarity-api"
    otel_exporter_otlp_endpoint: str = "http://localhost:4317"

    # Cloudflare R2 (optional — falls back to local filesystem storage in dev mode)
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = "clarity-docs"
    r2_endpoint_url: str | None = None

    # Upload limits
    max_upload_bytes: int = 50 * 1024 * 1024
    ingestion_lease_seconds: int = 900
    parser_version: str = "a3.v1"
    chunk_version: str = "a4.v1"
    chunk_target_tokens: int = 400
    chunk_max_tokens: int = 700
    chunk_overlap_tokens: int = 60
    embedding_provider: str = "openai"
    embedding_version: str = "a5.v1"
    embedding_batch_size: int = 32
    embedding_max_retries: int = 3
    embedding_timeout_seconds: int = 30
    embedding_lease_seconds: int = 900
    embedding_cost_per_1k_tokens_usd: float = 0.0
    persist_embedding_vectors_locally: bool = True
    index_provider: str = "pinecone"
    index_batch_size: int = 100
    index_max_retries: int = 3
    index_timeout_seconds: int = 30
    index_lease_seconds: int = 900
    retrieval_dense_top_k: int = 20
    retrieval_sparse_top_k: int = 20
    retrieval_final_top_k: int = 5
    retrieval_rrf_k: int = 60
    retrieval_cross_reference_limit: int = 2
    retrieval_cache_ttl_seconds: int = 60
    writer_prompt_version: str = "a8.writer.v1"
    writer_version: str = "a8.writer.v1"
    answer_stream_token_batch_size: int = 12
    answer_max_history_messages: int = 8
    llm_prompt_cost_per_1k_tokens_usd: float = 0.0
    llm_completion_cost_per_1k_tokens_usd: float = 0.0

    # B3 Evaluation platform
    judge_provider: str = "openai"
    judge_model: str = "gpt-4o-mini"
    judge_temperature: float = 0.0
    judge_prompt_version: str = "b3.judge.v1"
    eval_auto_judge: bool = True
    eval_regression_threshold: float = 10.0  # point drop on 0-100 scale that triggers a flag
    eval_regression_window: int = 10          # number of prior evals used as the baseline

    # LangSmith
    langchain_tracing_v2: bool = True
    langchain_api_key: str = ""
    langchain_project: str = "clarity"

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id_pro: str = ""    # Stripe Price ID for the Pro plan
    stripe_price_id_team: str = ""   # Stripe Price ID for the Team plan

    # App
    backend_url: str = "http://localhost:8000"
    environment: str = "development"


settings = Settings()
