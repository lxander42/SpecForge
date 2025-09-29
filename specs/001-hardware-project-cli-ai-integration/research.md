## Phase 0 Research: Hardware Project CLI with AI Integration

### Decisions
- AI provider adapter: abstract interface with providers (OpenAI, Azure OpenAI, Anthropic, Bedrock, local) selectable via env/config; require explicit allowlist of capabilities.
- GitHub Projects: use Projects v2 GraphQL for boards/views; REST for issues/labels/milestones. Fall back safely if v2 unavailable.
- Idempotency: deterministic slugs, content hashing, and upsert semantics; preserve manual edits using fenced sections and diff heuristics.
- Requirements package: text-first markdown under `requirements/` with `baselines/` snapshots and `CHANGELOG.md` for diff summaries.
- Labels/milestones: fixed taxonomy for phases, disciplines, complexity, AI-assistable; ensure existence before use.

### Rationale
- Provider-agnostic AI prevents lock-in and supports offline/local where needed.
- Projects v2 unlocks views/fields; REST covers mature resources reliably.
- Idempotency and edit preservation are critical for refactors and re-runs.
- Markdown keeps reviews in standard Git flows; baselines enable traceability.
- Upfront taxonomy standardizes queries/automation.

### Alternatives Considered
- Single-provider AI SDK: rejected due to lock-in and policy divergence.
- Pure REST for Projects: rejected; limited features for v2 boards/views.
- JSON requirements only: rejected; poor human review ergonomics.

### Unknowns Resolved
- Provider rate limits: implement exponential backoff, jitter, and max budget per run.
- Projects classic vs v2: prefer v2; detect and degrade gracefully.
- Manual edit preservation: fenced auto-managed blocks + heuristic merge.

### References
- Octokit REST + GraphQL clients
- oclif command patterns and cross-platform packaging

