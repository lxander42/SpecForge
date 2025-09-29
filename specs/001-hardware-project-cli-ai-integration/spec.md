# Feature Specification: Hardware Project CLI with AI Integration

**Feature Branch**: `001-hardware-project-cli-ai-integration`  
**Created**: 2025-09-28  
**Status**: Draft  
**Input**: User description: "Build an opinionated CLI that integrates with AI to plan hardware projects and generate a work breakdown structure (WBS) directly in GitHub. The CLI connects to the GitHub API to create and update issues, milestones, labels, and project boards with clear, human-readable descriptions. It must support both initializing new repositories and safely refactoring existing GitHub projects as the work unfolds (idempotent updates, no duplicate issues, preserving manual edits where possible). The CLI guides users (via README scaffolding and slash-command prompts) to initialize correctly, including a /constitution step for project-specific principles (e.g., only standard hardware, STM32 families or CAN interfaces, sensor accuracy targets, etc.). BOMs and CAD data remain in external tools; this CLI focuses on project planning, WBS, phase-gates, and requirements management. The WBS spans five phases with non-negotiable, checklist-based gates: (1) Concept & Feasibility (research, landscape scans, basic tests), (2) Preliminary Design (enumerate design directions with tradeoffs and choose a direction), (3) Detailed Design (execute the direction, procure parts, test), (4) Critical Design (review test data, cut in required changes), (5) Final Design (transition to production workflows). The CLI ships a comprehensive "golden project" checklist; during initialization it prunes items based on declared disciplines (Mechanical, Electrical, Firmware, Software) and project complexity via AI-guided questions. Checklists themselves are not user-generated; users can override enforcement, but opinionated defaults apply.Preliminary Design must produce a version-controlled, reviewable **Functional Requirements** package as a critical deliverable. The CLI generates a structured, text-based requirements set (committed to the repo) covering, at minimum: functional behavior, performance targets, environmental constraints, interfaces (electrical/mechanical/firmware/software), safety/regulatory, verification methods, and acceptance criteria. The tool supports change proposals and baselines: it creates issues for gaps, drafts updates, and assists with traceable revisions; approvals require designated project member sign-off and are merged via standard Git review (the phase gate cannot pass unless the requirements package is approved and committed). The CLI maintains requirements versioning and emits a clear change log between baselines, with each phase gate capturing a requirements snapshot. For each generated issue and milestone, the CLI adds phase tags, discipline tags, and—when applicable—an "AI-assistable" label. The AI-assistable label applies only to tasks that do not require an engineer's judgment or domain-critical design work (e.g., research concept generation, literature reviews, drafting requirement text from user inputs). It must never be applied to tasks like designing structural components, running FEA, or creating schematics/PCB layouts. Each AI-assistable item includes a short hint on how AI can help. Internal guidelines defining AI scope live in the CLI docs and are not emitted into project repos. Outputs include: (a) a populated GitHub Project with columns and views aligned to the five phases, (b) milestones for each phase gate with acceptance criteria, (c) labeled issues representing WBS items (with dependencies where helpful), (d) a repository-committed Requirements package with baseline tagging and approval workflow, (e) a README section explaining slash commands, phase flows, and how to request a refactor, and (f) labels for phases, disciplines, complexity, and AI-assistable. The CLI must support re-running to reconcile project state (add/remove/prune issues per updated inputs), preserve user edits, and provide a clear change summary. Primary goals: accelerate planning clarity, enforce traceable phase-gate rigor, generate and govern version-controlled functional requirements with explicit approvals, and make AI assistance helpful only where appropriate—never a substitute for engineering design or verification."

## Execution Flow (main)
```
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies  
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
**As a** hardware project manager or engineer, **I want to** use a CLI tool that integrates with AI to automatically plan my hardware project and generate a comprehensive work breakdown structure (WBS) directly in GitHub, **so that** I can accelerate project planning, enforce rigorous phase-gate processes, and maintain traceable functional requirements throughout the project lifecycle.

### Acceptance Scenarios
1. **Given** a new hardware project repository, **When** I run the CLI initialization command, **Then** the tool should guide me through project setup including discipline selection, complexity assessment, and constitution definition, and create a populated GitHub project with phase-aligned columns and labeled issues.

2. **Given** an existing hardware project with manual edits, **When** I run the CLI refactor command, **Then** the tool should safely update the project state by adding/removing/pruning issues based on updated inputs while preserving all manual edits and providing a clear change summary.

3. **Given** a project in Preliminary Design phase, **When** I complete the phase requirements, **Then** the CLI should generate a version-controlled Functional Requirements package with structured requirements covering functional behavior, performance targets, environmental constraints, interfaces, safety/regulatory needs, verification methods, and acceptance criteria.

4. **Given** a requirements package that needs updates, **When** I request changes through the CLI, **Then** the tool should create issues for gaps, draft updates, assist with traceable revisions, and require designated project member sign-off before merging via standard Git review.

5. **Given** a project with AI-assistable tasks, **When** I view the labeled issues, **Then** I should see clear hints on how AI can help with research, literature reviews, and requirement drafting, but never for engineering design tasks like FEA or schematic creation.

### Edge Cases
- The CLI implements automatic retries with exponential backoff for GitHub API unavailability or rate-limiting.
- The CLI intelligently merges non-conflicting changes and flags conflicts for manual review when reconciling project state with manual edits.
- The CLI blocks progression to the next phase automatically and notifies the project lead via issue when a phase gate cannot pass due to incomplete requirements approval.
- The CLI allows selection of multiple disciplines and adjusts complexity dynamically via AI-guided questions to include relevant checklist items for projects with mixed requirements or unusual complexity.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST provide a CLI interface for hardware project planning and WBS generation
- **FR-002**: System MUST integrate with GitHub API to create and update issues, milestones, labels, and project boards
- **FR-003**: System MUST support both new repository initialization and safe refactoring of existing projects
- **FR-004**: System MUST implement idempotent updates that prevent duplicate issues and preserve manual edits
- **FR-005**: System MUST guide users through initialization with README scaffolding and slash-command prompts
- **FR-006**: System MUST include a /constitution step for defining project-specific principles and constraints
- **FR-007**: System MUST implement a five-phase WBS with non-negotiable, checklist-based gates: (1) Concept & Feasibility, (2) Preliminary Design, (3) Detailed Design, (4) Critical Design, (5) Final Design
- **FR-008**: System MUST ship a comprehensive "golden project" checklist that prunes items based on declared disciplines and project complexity
- **FR-009**: System MUST generate AI-guided questions during initialization to customize the checklist
- **FR-010**: System MUST produce a version-controlled, reviewable Functional Requirements package as a critical deliverable in Preliminary Design phase
- **FR-011**: System MUST generate structured, text-based requirements covering functional behavior, performance targets, environmental constraints, interfaces, safety/regulatory needs, verification methods, and acceptance criteria
- **FR-012**: System MUST support change proposals and baselines for requirements with designated project member sign-off and Git review workflow
- **FR-013**: System MUST maintain requirements versioning and emit clear change logs between baselines
- **FR-014**: System MUST capture requirements snapshots at each phase gate
- **FR-015**: System MUST add phase tags, discipline tags, and AI-assistable labels to generated issues and milestones
- **FR-016**: System MUST apply AI-assistable labels only to tasks that do not require engineering judgment or domain-critical design work
- **FR-017**: System MUST include short hints on how AI can help for each AI-assistable item
- **FR-018**: System MUST populate GitHub Projects with columns and views aligned to the five phases
- **FR-019**: System MUST create milestones for each phase gate with acceptance criteria
- **FR-020**: System MUST generate labeled issues representing WBS items with dependencies where helpful
- **FR-021**: System MUST commit Requirements packages to the repository with baseline tagging and approval workflow
- **FR-022**: System MUST provide README sections explaining slash commands, phase flows, and refactor requests
- **FR-023**: System MUST create labels for phases, disciplines, complexity, and AI-assistable tasks
- **FR-024**: System MUST support re-running to reconcile project state and provide clear change summaries
- **FR-025**: System MUST never apply AI-assistable labels to tasks requiring engineering design or verification
- **FR-026**: System MUST intelligently merge non-conflicting changes and flag conflicts for manual review during project state reconciliation to preserve user edits.
- **FR-027**: System MUST block progression to the next phase and notify the project lead via issue when a phase gate cannot pass due to incomplete requirements approval.
- **FR-028**: System MUST allow selection of multiple disciplines and adjust complexity dynamically via AI-guided questions during initialization to handle mixed requirements and prune checklists appropriately.

### Non-Functional Requirements
- **NFR-001**: The CLI must handle GitHub API failures reliably by implementing automatic retries with exponential backoff (up to a reasonable limit, e.g., 5 attempts) to ensure robust integration without immediate failure.
- **NFR-002**: The CLI must require a personal access token (PAT) provided via environment variable or secure config file for GitHub API authentication.

### Key Entities
- **Project**: Represents a hardware project with associated metadata, disciplines, complexity level, and constitution
- **Phase**: Represents one of the five project phases (Concept & Feasibility, Preliminary Design, Detailed Design, Critical Design, Final Design) with associated gates and acceptance criteria
- **Requirements Package**: Version-controlled document containing structured functional requirements with baseline tagging and approval workflow
- **WBS Item**: Individual work breakdown structure item represented as a GitHub issue with phase tags, discipline tags, and AI-assistable labels
- **Constitution**: Project-specific principles and constraints that guide project execution and checklist pruning
- **Discipline**: Engineering discipline (Mechanical, Electrical, Firmware, Software) that affects which checklist items are included
- **Phase Gate**: Non-negotiable checkpoint with acceptance criteria that must be met before proceeding to the next phase

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous  
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---

## Clarifications

### Session 2025-09-29

- Q: When the GitHub API is unavailable or rate-limited during CLI operations (e.g., creating issues or updating projects), what should the CLI do? → A: Implement automatic retries with exponential backoff (up to a reasonable limit).
- Q: When the CLI reconciles project state and detects conflicts with manual edits (e.g., user-modified issue descriptions or assignees), what should it do? → A: Intelligently merge non-conflicting parts and flag conflicts for manual review.
- Q: What should occur when a phase gate cannot pass due to incomplete requirements approval (e.g., no designated member sign-off)? → A: Block progression to the next phase automatically and notify the project lead via issue or email.
- Q: How should the CLI handle authentication with the GitHub API? → A: Require a personal access token (PAT) provided via environment variable or secure config file.
- Q: How should the CLI handle projects with mixed discipline requirements (e.g., both Mechanical and Electrical) or unusual complexity levels during checklist pruning and initialization? → A: Allow selection of multiple disciplines and adjust complexity dynamically via AI-guided questions to include relevant checklist items.

---
