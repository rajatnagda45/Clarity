from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # OpenAI
    openai_api_key: str
    llm_model: str = "gpt-4o-mini"
    embed_model: str = "text-embedding-3-small"
    embed_dim: int = 1536

    # Two-signal verifier
    nli_provider: str = "hosted"          # hosted | openai
    nli_model: str = ""                   # DeBERTa endpoint id when nli_provider=hosted
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

    # Cohere
    cohere_api_key: str

    # Supabase
    supabase_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    # Clerk
    clerk_secret_key: str
    next_public_clerk_publishable_key: str = ""

    # Upstash Redis
    upstash_redis_rest_url: str
    upstash_redis_rest_token: str

    # Cloudflare R2
    r2_account_id: str
    r2_access_key_id: str
    r2_secret_access_key: str
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

    # LangSmith
    langchain_tracing_v2: bool = True
    langchain_api_key: str = ""
    langchain_project: str = "clarity"

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # App
    backend_url: str = "http://localhost:8000"
    environment: str = "development"


settings = Settings()
