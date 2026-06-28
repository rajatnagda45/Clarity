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
