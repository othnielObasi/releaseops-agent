"""
ReleaseOps  domain package.

This directory is the starting point for evolving the current monolith into
a modular monolith:
- app/domain  -> core business logic (sessions, readiness pipeline, auth)
- app/infra   -> config, logging, storage, external services (OpenAI, email)
- app/api     -> FastAPI routers and request/response models
- app/agents  -> Navigator/Sentinel/Herald agent wrappers

For now, most logic still lives in main.py. Future refactors can progressively
move functions and classes into these modules without changing the external
API or deployment model.
"""
