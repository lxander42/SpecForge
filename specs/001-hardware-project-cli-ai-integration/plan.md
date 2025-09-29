
# Implementation Plan: Hardware Project CLI with AI Integration

**Branch**: `001-hardware-project-cli-ai-integration` | **Date**: 2025-09-28 | **Spec**: /mnt/c/SpecForge/specs/001-hardware-project-cli-ai-integration/spec.md
**Input**: Feature specification from `/specs/001-hardware-project-cli-ai-integration/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Build a cross-platform TypeScript/Node.js CLI (oclif) that orchestrates GitHub Projects (via Octokit) to scaffold and refactor WBS across five phase-gates, generate and govern a version-controlled Functional Requirements package, and integrate provider-agnostic AI to prune checklists, draft requirement text, and flag AI-assistable tasks with strict prohibitions on engineering judgment tasks. The CLI must be idempotent, safe on reruns, and provide an interactive init wizard, ASCII forge-style splash animation, robust error handling, and clear change summaries.

## Technical Context
**Language/Version**: TypeScript (Node.js 20+)
**Primary Dependencies**: oclif, Octokit, zod, inquirer, ora, chalk, node-fetch/undici, js-yaml
**Storage**: Repo files (requirements package, baselines, changelogs) in Git; local config under `.specforge/`
**Testing**: vitest + ts-node for integration stubs; contract tests generated from Phase 1
**Target Platform**: Windows, macOS, Linux (Node.js CLI)
**Project Type**: single (CLI + services)
**Performance Goals**: Create/update 500 issues < 60s with backoff; p95 command < 5s when no-op
**Constraints**: Idempotent operations; rate-limit safe; human edits preserved; machine-parseable `--json` outputs
**Scale/Scope**: Teams 2-50; projects up to 2k issues; 5 phase-gates; 4 disciplines

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- User-Centric Design: Interactive wizard, `--yes/--json`, actionable errors → PASS
- Specification Integrity: Versioned requirements, baselines, approvals → PASS
- Modular Architecture: oclif commands + services + adapters → PASS
- Performance & Scalability: Backoff, batching, pagination → PASS
- Cross-Platform Compatibility: Pure Node + no shell assumptions → PASS
- Development Standards: Lint/tests/docs planned; helpful errors → PASS

## Project Structure

### Documentation (this feature)
```
specs/001-hardware-project-cli-ai-integration/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── cli/                 # oclif command implementations
│   ├── init.ts          # interactive init wizard + ASCII splash
│   ├── plan.ts          # regenerates WBS + requirements
│   ├── refactor.ts      # reconcile existing projects
│   ├── baseline.ts      # requirements baselining + changelog
│   └── labels.ts        # ensure labels/milestones/projects
├── services/
│   ├── github/          # Octokit wrappers (labels, issues, projects, milestones)
│   ├── requirements/    # package writer, baselines, approvals
│   ├── wbs/             # phase/discipline checklists, pruning
│   ├── reconciliation/  # idempotent diff + merge
│   ├── ai/              # provider-agnostic adapter + policies
│   └── telemetry/       # logging, metrics
├── lib/
│   ├── errors.ts        # typed error hierarchy
│   ├── config.ts        # load/save PAT, org/repo, options
│   ├── rules.ts         # AI guardrails: prohibited tasks
│   ├── ascii.ts         # forge-style splash animation
│   ├── prompts.ts       # inquirer steps with validation
│   ├── idempotency.ts   # content hashing, reconciliation helpers
│   └── schema.ts        # zod schemas for config/artifacts
└── models/
    ├── entities.ts      # Project, Phase, Requirement, WBS item
    └── types.ts         # shared types/enums/labels

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Single project CLI (`src/cli`, `src/services`, `src/lib`, `src/models`) with tests directory.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - AI provider abstraction details and rate-limit envelopes
   - GitHub Projects (classic vs v2) coverage and Octokit endpoints
   - Idempotent strategies for preserving manual edits safely
   - Requirements package format and baseline tagging strategy
   - Label/milestone taxonomy and views
2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for SpecForge hardware CLI"
   For each technology choice:
     Task: "Find best practices for {tech} in cross-platform Node CLI"
   ```
3. **Consolidate findings** in `research.md` using format:
   - Decision, Rationale, Alternatives considered

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Project, Phase, RequirementsPackage, Requirement, WbsItem, Baseline, ChangeLog
   - Validation rules and state transitions
2. **Generate API contracts** from functional requirements:
   - Contract files under `/contracts/` for init/refactor/requirements actions (JSON schemas)
3. **Generate contract tests** from contracts:
   - One test per contract, failing initially
4. **Extract test scenarios** from user stories:
   - Integration flows for init, refactor, baseline approval
5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh cursor`

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P]
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: Models before services before CLI commands
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

## Complexity Tracking
| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Progress Tracking
**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v1.0.0 - See `/.specify/memory/constitution.md`*
