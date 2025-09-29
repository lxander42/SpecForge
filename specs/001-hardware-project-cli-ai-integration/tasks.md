---
title: Tasks – Hardware Project CLI with AI Integration
description: Dependency-ordered, parallelizable tasks for implementing the CLI per design artifacts
feature: Hardware Project CLI with AI Integration
feature_dir: C:\\SpecForge\\specs\\001-hardware-project-cli-ai-integration
repo_root: C:\\SpecForge
---

Notes
- All file paths are absolute.
- [P] indicates tasks that can run in parallel (touch different files).
- Follow order strictly unless tasks are grouped under the same Parallel Group.
- Tests first (TDD): contract and integration tests before implementation.

Parallel Execution Examples
- Run contract tests together [P]:
  - Command (PowerShell): `npm run test:contracts --workspaces | cat`
- Run independent unit tasks [P] that touch different files:
  - Example: `npm run test -w` in parallel terminals for T011, T012, T013
- Run specific tests by pattern:
  - `npx vitest run C:\\SpecForge\\tests\\contract\\*.test.ts --reporter verbose`

Dependencies Order
1) Setup → 2) Tests → 3) Models → 4) Services → 5) CLI commands → 6) Integration glue → 7) Polish

Tasks

[X] T001. Initialize Node/TypeScript workspace and structure (repo-wide)
- Files/Dirs: C:\\SpecForge\\package.json, tsconfig.json, .npmrc, .gitignore, .eslint.cjs, .prettierrc, C:\\SpecForge\\src\\, C:\\SpecForge\\tests\\
- Scripts: build, test, test:unit, test:contract, test:integration, lint, typecheck
- Result: Baseline tooling ready
- Run: `npm init -y && npm pkg set type=module`

[X] T002. Install runtime dependencies
- Deps: oclif, @oclif/core, @octokit/rest, @octokit/graphql, zod, inquirer, ora, chalk, undici, js-yaml
- Run: `npm i @oclif/core @octokit/rest @octokit/graphql zod inquirer ora chalk undici js-yaml`

[X] T003. Install dev dependencies
- DevDeps: typescript, vitest, ts-node, @types/node, eslint, @typescript-eslint/parser, @typescript-eslint/eslint-plugin, prettier, tsx
- Run: `npm i -D typescript vitest ts-node @types/node eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier tsx`

[X] T004. Project layout per plan.md
- Create directories:
  - C:\\SpecForge\\src\\cli\\
  - C:\\SpecForge\\src\\services\\github\\
  - C:\\SpecForge\\src\\services\\requirements\\
  - C:\\SpecForge\\src\\services\\wbs\\
  - C:\\SpecForge\\src\\services\\reconciliation\\
  - C:\\SpecForge\\src\\services\\ai\\
  - C:\\SpecForge\\src\\services\\telemetry\\
  - C:\\SpecForge\\src\\lib\\
  - C:\\SpecForge\\src\\models\\
  - C:\\SpecForge\\tests\\contract\\
  - C:\\SpecForge\\tests\\integration\\
  - C:\\SpecForge\\tests\\unit\\
- Run: `mkdir -Force C:\\SpecForge\\src\\cli,src\\services\\github,src\\services\\requirements,src\\services\\wbs,src\\services\\reconciliation,src\\services\\ai,src\\services\\telemetry,src\\lib,src\\models,tests\\contract,tests\\integration,tests\\unit`

[X] T005. Configure TypeScript and Vitest
- Files: C:\\SpecForge\\tsconfig.json, C:\\SpecForge\\vitest.config.ts
- Add path aliases if desired (e.g., @src/*)
- Run: `npx tsc --init` then create vitest config

[X] T006. ESLint/Prettier baseline
- Files: C:\\SpecForge\\.eslint.cjs, C:\\SpecForge\\.prettierrc
- Rules: Typescript + import order, no-floating-promises, etc.
- Run: `npx eslint --init | cat`

[X] T007. Seed readme and CLI bin entry
- Files: C:\\SpecForge\\README.md, C:\\SpecForge\\bin\\specforge.js (oclif entry)
- Wire package.json bin: "specforge": "bin/specforge.js"
- Run: `npm pkg set bin.specforge="bin/specforge.js"`

[X] T008. Contract test for init.schema.json [P]
- Test: C:\\SpecForge\\tests\\contract\\init.contract.test.ts
- Contract: C:\\SpecForge\\specs\\001-hardware-project-cli-ai-integration\\contracts\\init.schema.json
- Behavior: Validate required fields, enum constraints, additionalProperties=false
- Run: `npx vitest run C:\\SpecForge\\tests\\contract\\init.contract.test.ts`

[X] T009. Contract test for refactor.schema.json [P]
- Test: C:\\SpecForge\\tests\\contract\\refactor.contract.test.ts
- Contract: C:\\SpecForge\\specs\\001-hardware-project-cli-ai-integration\\contracts\\refactor.schema.json
- Behavior: Validate required fields, flags, additionalProperties=false
- Run: `npx vitest run C:\\SpecForge\\tests\\contract\\refactor.contract.test.ts`

[X] T010. Integration test: initialize a new project [P]
- Test: C:\\SpecForge\\tests\\integration\\init.flow.test.ts
- Scenario (quickstart + spec): creates labels, milestones, project board, issues; prunes checklists; requirements scaffold
- Run: `npx vitest run C:\\SpecForge\\tests\\integration\\init.flow.test.ts`

[X] T011. Integration test: refactor existing project [P]
- Test: C:\\SpecForge\\tests\\integration\\refactor.flow.test.ts
- Scenario: reconcile/prune, preserve manual edits, change summary
- Run: `npx vitest run C:\\SpecForge\\tests\\integration\\refactor.flow.test.ts`

[X] T012. Integration test: requirements package generation [P]
- Test: C:\\SpecForge\\tests\\integration\\requirements.flow.test.ts
- Scenario: generate structured package, baseline tagging, approval gate
- Run: `npx vitest run C:\\SpecForge\\tests\\integration\\requirements.flow.test.ts`

[X] T013. Integration test: change proposals and approvals [P]
- Test: C:\\SpecForge\\tests\\integration\\requirements-change.flow.test.ts
- Scenario: create issues for gaps, draft updates, sign-off required
- Run: `npx vitest run C:\\SpecForge\\tests\\integration\\requirements-change.flow.test.ts`

[X] T014. Integration test: AI-assistable labeling policy [P]
- Test: C:\\SpecForge\\tests\\integration\\ai-labeling.flow.test.ts
- Scenario: apply AI-assistable only where allowed; include hints; never for design/verification tasks
- Run: `npx vitest run C:\\SpecForge\\tests\\integration\\ai-labeling.flow.test.ts`

[X] T015. Create models: entities.ts (Project)
- File: C:\\SpecForge\\src\\models\\entities.ts
- Add types/zod schema for Project per data-model.md
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\models.entities.project.test.ts`

[X] T016. Create models: entities.ts (Phase)
- File: C:\\SpecForge\\src\\models\\entities.ts
- Add Phase with gate criteria and milestoneId
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\models.entities.phase.test.ts`

[X] T017. Create models: entities.ts (RequirementsPackage)
- File: C:\\SpecForge\\src\\models\\entities.ts
- Add RequirementsPackage (path, version, baselineTag, sections)
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\models.entities.requirementsPackage.test.ts`

[X] T018. Create models: entities.ts (Requirement)
- File: C:\\SpecForge\\src\\models\\entities.ts
- Add Requirement (id, section, text, acceptanceCriteria, verificationMethod)
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\models.entities.requirement.test.ts`

[X] T019. Create models: entities.ts (WbsItem)
- File: C:\\SpecForge\\src\\models\\entities.ts
- Add WbsItem (id, title, phase, disciplineTags, aiAssistable, aiHint, dependencies)
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\models.entities.wbsItem.test.ts`

[X] T020. Create models: entities.ts (Baseline, ChangeLog)
- File: C:\\SpecForge\\src\\models\\entities.ts
- Add Baseline and ChangeLog structures
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\models.entities.baseline-changelog.test.ts`

[X] T021. Core lib: typed errors and idempotency helpers [P]
- Files: C:\\SpecForge\\src\\lib\\errors.ts, C:\\SpecForge\\src\\lib\\idempotency.ts
- Implement error hierarchy; content hashing and upsert helpers
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\lib.errors-idempotency.test.ts`

[X] T022. Core lib: config, prompts, ascii, rules [P]
- Files: C:\\SpecForge\\src\\lib\\config.ts, C:\\SpecForge\\src\\lib\\prompts.ts, C:\\SpecForge\\src\\lib\\ascii.ts, C:\\SpecForge\\src\\lib\\rules.ts
- Implement config load/save, inquirer steps, splash animation, AI guardrails
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\lib.core-assets.test.ts`

[X] T023. Core lib: shared schemas [P]
- File: C:\\SpecForge\\src\\lib\\schema.ts
- Zod schemas mirroring entities and CLI inputs
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\lib.schema.test.ts`

[X] T024. GitHub services: REST and GraphQL clients [P]
- Files: C:\\SpecForge\\src\\services\\github\\client.ts, C:\\SpecForge\\src\\services\\github\\projects.ts
- Implement REST/GraphQL setup, rate-limit safe backoff
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\services.github.clients.test.ts`

[X] T025. GitHub services: labels, issues, milestones [P]
- Files: C:\\SpecForge\\src\\services\\github\\labels.ts, C:\\SpecForge\\src\\services\\github\\issues.ts, C:\\SpecForge\\src\\services\\github\\milestones.ts
- Implement create/update and ensure-exists operations
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\services.github.resources.test.ts`

[X] T026. WBS and reconciliation services [P]
- Files: C:\\SpecForge\\src\\services\\wbs\\generator.ts, C:\\SpecForge\\src\\services\\reconciliation\\diff.ts
- Implement golden checklist, pruning, and idempotent diff/merge
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\services.wbs-recon.test.ts`

[X] T027. Requirements package service [P]
- Files: C:\\SpecForge\\src\\services\\requirements\\writer.ts
- Implement markdown writer, baselines under requirements/ and baselines/
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\services.requirements.test.ts`

[X] T028. AI adapter service [P]
- Files: C:\\SpecForge\\src\\services\\ai\\provider.ts
- Abstract interface with allowlisted capabilities; pluggable providers
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\services.ai.adapter.test.ts`

[X] T029. Telemetry/logging service [P]
- Files: C:\\SpecForge\\src\\services\\telemetry\\logger.ts
- Implement structured logging, metrics hooks
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\services.telemetry.test.ts`

[X] T030. CLI command: init (failing, wire to services)
- File: C:\\SpecForge\\src\\cli\\init.ts
- Reads inputs per init.schema.json; dryRun and --json supported
- Run: `npx tsx C:\\SpecForge\\src\\cli\\init.ts --help | cat`

[X] T031. CLI command: plan
- File: C:\\SpecForge\\src\\cli\\plan.ts
- Regenerate WBS + requirements previews (no writes by default)
- Run: `npx tsx C:\\SpecForge\\src\\cli\\plan.ts --help | cat`

[X] T032. CLI command: refactor
- File: C:\\SpecForge\\src\\cli\\refactor.ts
- Reconcile state with --reconcile/--prune and --json outputs
- Run: `npx tsx C:\\SpecForge\\src\\cli\\refactor.ts --help | cat`

[X] T033. CLI command: baseline
- File: C:\\SpecForge\\src\\cli\\baseline.ts
- Approve requirements baseline and tag
- Run: `npx tsx C:\\SpecForge\\src\\cli\\baseline.ts --help | cat`

[X] T034. CLI command: labels
- File: C:\\SpecForge\\src\\cli\\labels.ts
- Ensure labels/milestones/projects exist
- Run: `npx tsx C:\\SpecForge\\src\\cli\\labels.ts --help | cat`

[X] T035. CLI command: constitution
- File: C:\\SpecForge\\src\\cli\\constitution.ts
- Implement /constitution step for project-specific principles and constraints
- Run: `npx tsx C:\\SpecForge\\src\\cli\\constitution.ts --help | cat`

[X] T036. README section generation service (missing coverage for FR-022)
- Files: C:\\SpecForge\\src\\services\\requirements\\readme.ts
- Generate README sections explaining slash commands, phase flows, and refactor requests
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\services.requirements.readme.test.ts`

T037. Make contract tests pass by implementing minimal validation wiring
- Files: C:\\SpecForge\\src\\lib\\schema.ts, C:\\SpecForge\\src\\cli\\init.ts, C:\\SpecForge\\src\\cli\\refactor.ts
- Ensure commands validate against schemas before execution
- Run: `npm run test:contract`

T038. Make integration tests pass for init and refactor
- Files: C:\\SpecForge\\src\\services\\github\\*, C:\\SpecForge\\src\\services\\wbs\\*, C:\\SpecForge\\src\\services\\reconciliation\\*, C:\\SpecForge\\src\\cli\\init.ts, C:\\SpecForge\\src\\cli\\refactor.ts
- Implement flows end-to-end with dryRun stubs if needed
- Run: `npm run test:integration`

T039. Make integration tests pass for requirements and approvals
- Files: C:\\SpecForge\\src\\services\\requirements\\*, C:\\SpecForge\\src\\cli\\baseline.ts
- Implement baseline tagging and changelog emission
- Run: `npm run test:integration`

T040. Make AI-assistable labeling test pass
- Files: C:\\SpecForge\\src\\lib\\rules.ts, C:\\SpecForge\\src\\services\\wbs\\generator.ts
- Enforce policy and attach hints appropriately
- Run: `npm run test:integration`

T041. Integration glue: retries/backoff and graceful degradation [P]
- Files: C:\\SpecForge\\src\\services\\github\\client.ts
- Implement exponential backoff with jitter and budget caps
- Run: `npx vitest run C:\\SpecForge\\tests\\unit\\services.github.retry.test.ts`

T042. Polish: unit tests for libs and services [P]
- Files: C:\\SpecForge\\tests\\unit\\**\\*.test.ts
- Increase coverage for lib and service helpers
- Run: `npm run test:unit`

T043. Polish: performance pass and no-op fast paths [P]
- Files: C:\\SpecForge\\src\\services\\reconciliation\\diff.ts, C:\\SpecForge\\src\\services\\github\\*
- Add batching/pagination and p95 no-op paths
- Run: `npm run test && npm run typecheck`

T044. Polish: docs and README
- Files: C:\\SpecForge\\README.md
- Document commands, JSON outputs, and safety guarantees
- Run: `git add README.md && git commit -m "docs: update README for CLI"`

Parallel Groups
- Group A [P]: T008, T009 (contract tests)
- Group B [P]: T010, T011, T012, T013, T014 (integration tests authoring)
- Group C [P]: T021, T022, T023 (core libs)
- Group D [P]: T024, T025, T026, T027, T028, T029 (services)
- Group E [P]: T040, T041, T042 (polish)

Dependency Notes
- T001–T007 must precede all others
- Contract tests (T008–T009) precede CLI wiring (T030, T032, T035, T037)
- Integration tests (T010–T014) precede feature implementations (T038–T040)
- Models (T015–T020) precede services (T024–T029, T036)
- Services precede CLI commands (T030–T035)
- README service (T036) precedes CLI commands that generate README sections
- Integration glue (T041) after core flows (T038–T040)
- Polish (T042–T044) last


