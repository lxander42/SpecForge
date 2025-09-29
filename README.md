# SpecForge CLI

> "Where specs are hammered into real hardware."

SpecForge is a hardware specification CLI that bridges the gap between innovation and manufacturing. It guides teams from idea through prototype to production with structured templates, Work Breakdown Structure (WBS) generation, and phase-gate management.

## Features

- **Interactive Project Initialization**: Set up hardware projects with structured phases and disciplines
- **GitHub Integration**: Automatically create labels, milestones, and project boards
- **Requirements Management**: Version-controlled functional requirements with baseline tracking
- **AI-Assisted Workflow**: Intelligent task pruning and requirement drafting (with guardrails)
- **Idempotent Operations**: Safe to re-run commands without duplicating work
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **JSON Output**: Machine-readable outputs for integration with other tools

## Prerequisites

- Node.js 20+
- GitHub Personal Access Token in `GITHUB_TOKEN` environment variable
  - Required scopes: `repo`, `project`, `write:org` (for organization projects)

## Installation

```bash
npm install -g specforge
```

## Quick Start

### 1. Initialize a new project
```bash
specforge init --org your-org --repo your-repo \
  --disciplines Mechanical Electrical Firmware \
  --complexity medium
```

This creates:
- GitHub labels for phases, disciplines, and complexity levels
- Milestones for each project phase
- Project board with appropriate columns
- Initial Work Breakdown Structure (WBS) as GitHub issues
- Requirements package scaffold

### 2. Re-run safely (idempotent)
```bash
specforge plan --json
specforge refactor --reconcile --prune --json
```

### 3. Requirements baseline
```bash
specforge baseline --approve --tag v0.1-reqs
```

## Commands

### `init` - Initialize New Project

Initialize a new hardware project with GitHub integration and requirements scaffolding.

```bash
specforge init [options]
```

**Options:**
- `-o, --org <org>` - GitHub organization or user name (required)
- `-r, --repo <repo>` - GitHub repository name (required)
- `-d, --disciplines <disciplines...>` - Project disciplines: Mechanical, Electrical, Firmware, Software (required)
- `-c, --complexity <level>` - Project complexity: low, medium, high (required)
- `--ai-provider <provider>` - AI provider: openai, anthropic, mock (default: mock)
- `--dry-run` - Show what would be created without making changes
- `--json` - Output results in JSON format

**Examples:**
```bash
# Basic initialization
specforge init --org myorg --repo myproject --disciplines Mechanical Electrical --complexity medium

# With dry run to preview changes
specforge init --org myorg --repo myproject --disciplines Firmware Software --complexity high --dry-run

# JSON output for scripting
specforge init --org myorg --repo myproject --disciplines Mechanical --complexity low --json
```

**JSON Output:**
```json
{
  "success": true,
  "project": {
    "org": "myorg",
    "repo": "myproject",
    "disciplines": ["Mechanical", "Electrical"],
    "complexity": "medium"
  },
  "created": {
    "labels": 15,
    "milestones": 5,
    "projects": 1,
    "issues": 42
  },
  "requirements": {
    "packagesCreated": 1,
    "sectionsGenerated": 7
  },
  "wbs": {
    "itemsGenerated": 42,
    "aiAssistableItems": 18
  },
  "dryRun": false,
  "duration": 15420
}
```

### `plan` - Regenerate WBS and Requirements

Regenerate Work Breakdown Structure and requirements previews based on current project configuration.

```bash
specforge plan [options]
```

**Options:**
- `-o, --org <org>` - GitHub organization (optional, uses saved config)
- `-r, --repo <repo>` - GitHub repository (optional, uses saved config)
- `-d, --disciplines <disciplines...>` - Override project disciplines
- `-c, --complexity <level>` - Override project complexity
- `--dry-run` - Show what would be generated without making changes
- `--json` - Output results in JSON format

**Examples:**
```bash
# Regenerate with current settings
specforge plan

# Override complexity for planning
specforge plan --complexity high --dry-run

# JSON output
specforge plan --json
```

### `refactor` - Reconcile Project State

Reconcile existing project state with current specifications, preserving manual edits.

```bash
specforge refactor [options]
```

**Options:**
- `-o, --org <org>` - GitHub organization (required)
- `-r, --repo <repo>` - GitHub repository (required)
- `--reconcile` - Reconcile differences between current and desired state
- `--prune` - Remove items that are no longer needed
- `--preserve-edits` - Preserve manual edits during reconciliation (default: true)
- `--dry-run` - Show what would be changed without making changes
- `--json` - Output results in JSON format
- `-v, --verbose` - Verbose output with detailed change information

**Examples:**
```bash
# Analyze differences (dry run)
specforge refactor --org myorg --repo myproject --dry-run

# Reconcile and add missing items
specforge refactor --org myorg --repo myproject --reconcile

# Reconcile and remove obsolete items
specforge refactor --org myorg --repo myproject --reconcile --prune

# JSON output for automation
specforge refactor --org myorg --repo myproject --reconcile --json
```

**JSON Output:**
```json
{
  "success": true,
  "project": {
    "org": "myorg",
    "repo": "myproject",
    "disciplines": ["Mechanical", "Electrical"],
    "complexity": "medium"
  },
  "reconciliation": {
    "itemsAnalyzed": 45,
    "itemsAdded": 3,
    "itemsModified": 2,
    "itemsRemoved": 1,
    "itemsUnchanged": 39,
    "manualEditsPreserved": 2
  },
  "github": {
    "issuesCreated": 3,
    "issuesUpdated": 2,
    "issuesRemoved": 1
  },
  "changes": [
    {
      "type": "added",
      "item": "WBS-046",
      "description": "Add new task: Design power management circuit"
    },
    {
      "type": "modified",
      "item": "WBS-023",
      "description": "Update title, aiHint: Firmware initialization sequence",
      "preservedEdit": false
    }
  ],
  "dryRun": false,
  "duration": 8750
}
```

### `baseline` - Requirements Baseline Management

Approve and tag requirements baselines for traceability and change control.

```bash
specforge baseline [options]
```

**Options:**
- `-o, --org <org>` - GitHub organization (required)
- `-r, --repo <repo>` - GitHub repository (required)
- `-t, --tag <tag>` - Git tag for baseline (required)
- `--approve` - Approve the baseline (required for tagging)
- `--approver <name>` - Name of approver (optional, uses git config)
- `--dry-run` - Show what would be baselined without making changes
- `--json` - Output results in JSON format

**Examples:**
```bash
# Create requirements baseline
specforge baseline --org myorg --repo myproject --tag v1.0-reqs --approve

# With specific approver
specforge baseline --org myorg --repo myproject --tag v1.1-reqs --approve --approver "John Doe"

# Preview baseline
specforge baseline --org myorg --repo myproject --tag v1.0-reqs --approve --dry-run
```

### `labels` - Ensure Labels and Milestones

Ensure required GitHub labels, milestones, and project boards exist.

```bash
specforge labels [options]
```

**Options:**
- `-o, --org <org>` - GitHub organization (required)
- `-r, --repo <repo>` - GitHub repository (required)
- `--dry-run` - Show what would be created without making changes
- `--json` - Output results in JSON format

**Examples:**
```bash
# Ensure all labels exist
specforge labels --org myorg --repo myproject

# Preview what would be created
specforge labels --org myorg --repo myproject --dry-run
```

### `constitution` - Project Constitution Management

Manage project-specific principles and constraints.

```bash
specforge constitution [options]
```

**Options:**
- `-o, --org <org>` - GitHub organization (required)
- `-r, --repo <repo>` - GitHub repository (required)
- `--dry-run` - Show what would be created without making changes
- `--json` - Output results in JSON format

## Project Structure

SpecForge creates a structured project layout:

```
your-repo/
├── requirements/                 # Requirements package
│   ├── functional.md            # Functional requirements
│   ├── performance.md           # Performance requirements
│   ├── environmental.md         # Environmental requirements
│   ├── interfaces.md            # Interface requirements
│   ├── safety.md               # Safety requirements
│   ├── verification.md         # Verification methods
│   └── acceptance.md           # Acceptance criteria
├── baselines/                   # Requirements baselines
│   ├── v1.0-reqs/              # Tagged baseline
│   └── CHANGELOG.md            # Change history
└── .specforge/                 # Configuration
    └── config.json             # Project settings
```

## Phase Management

SpecForge organizes work into five phase-gates:

1. **Concept** - Initial idea validation and feasibility
2. **Preliminary** - High-level design and architecture
3. **Detailed** - Detailed design and component selection
4. **Critical** - Design verification and validation
5. **Final** - Production preparation and handoff

Each phase has:
- Gate criteria that must be met before proceeding
- Discipline-specific tasks (Mechanical, Electrical, Firmware, Software)
- AI-assistable and human-only task classifications
- Dependencies between tasks

## AI Usage Policy

SpecForge includes AI assistance with strict guardrails:

### ✅ AI is Allowed For:
- Pruning unnecessary checklist items based on project complexity
- Drafting initial requirement text from specifications
- Generating task descriptions and acceptance criteria
- Providing hints for AI-assistable tasks
- Suggesting requirement traceability links

### ❌ AI is Prohibited From:
- Making engineering judgment calls on safety-critical systems
- Performing finite element analysis (FEA) or structural calculations
- Creating electrical schematics or PCB layouts
- Writing firmware or embedded software code
- Making component selection decisions
- Approving design reviews or verification results
- Determining compliance with safety standards

### AI Hint System
Tasks marked as AI-assistable include contextual hints:
- "Focus on power consumption optimization strategies"
- "Consider EMI/EMC compliance requirements early"
- "Review thermal management approaches for high-power components"

## Safety Guarantees

SpecForge provides several safety guarantees for production use:

### Idempotency
- All commands are safe to re-run multiple times
- No duplicate GitHub issues, labels, or milestones are created
- Existing manual edits are preserved during reconciliation

### Manual Edit Preservation
- User modifications to GitHub issue titles and descriptions are preserved
- Fenced sections in requirements documents protect manual content
- Change detection identifies and preserves human edits

### Audit Trail
- All changes are logged with timestamps and reasoning
- Requirements baselines create immutable snapshots
- Git tags provide traceability for approved baselines

### Rate Limiting
- Exponential backoff with jitter prevents GitHub API abuse
- Configurable rate limits respect API quotas
- Graceful degradation when rate limits are exceeded

### Validation
- Schema validation ensures data integrity
- Contract tests verify API compatibility
- Integration tests validate end-to-end workflows

## Configuration

SpecForge stores configuration in `.specforge/config.json`:

```json
{
  "project": {
    "org": "your-org",
    "repo": "your-repo",
    "disciplines": ["Mechanical", "Electrical"],
    "complexity": "medium",
    "initialized": true,
    "initializedAt": "2024-01-15T10:30:00Z"
  },
  "github": {
    "token": "env:GITHUB_TOKEN"
  },
  "ai": {
    "provider": "mock",
    "model": "gpt-4"
  },
  "behavior": {
    "dryRun": false,
    "verbose": false,
    "json": false
  },
  "paths": {
    "requirements": "requirements/",
    "baselines": "baselines/",
    "specs": "specs/"
  },
  "performance": {
    "maxConcurrentRequests": 5,
    "retryAttempts": 3,
    "timeoutMs": 30000
  }
}
```

## Environment Variables

- `GITHUB_TOKEN` - GitHub Personal Access Token (required)
- `SPECFORGE_AI_PROVIDER` - AI provider override (optional)
- `SPECFORGE_LOG_LEVEL` - Log level: debug, info, warn, error (default: info)
- `SPECFORGE_DRY_RUN` - Enable dry run mode globally (optional)

## Troubleshooting

### Common Issues

**GitHub API Rate Limits**
```bash
# Check current rate limit status
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/rate_limit

# Use --dry-run to preview changes without API calls
specforge refactor --org myorg --repo myproject --dry-run
```

**Permission Errors**
Ensure your GitHub token has the required scopes:
- `repo` - Full repository access
- `project` - Project board access
- `write:org` - Organization project access (for org-level projects)

**Schema Validation Errors**
```bash
# Validate project configuration
specforge plan --dry-run --json | jq '.success'

# Check for schema mismatches in requirements
specforge baseline --dry-run --json
```

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
# Environment variable
export SPECFORGE_LOG_LEVEL=debug
specforge init --org myorg --repo myproject --disciplines Mechanical

# Command flag
specforge refactor --org myorg --repo myproject --verbose
```

## Integration Examples

### CI/CD Pipeline

```yaml
name: SpecForge Validation
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g specforge
      - run: specforge refactor --org ${{ github.repository_owner }} --repo ${{ github.event.repository.name }} --dry-run --json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Automated Baseline Creation

```bash
#!/bin/bash
# Create baseline on release
VERSION=$(git describe --tags --abbrev=0)
specforge baseline --org myorg --repo myproject --tag "${VERSION}-reqs" --approve --json > baseline-result.json

if jq -e '.success' baseline-result.json > /dev/null; then
  echo "✅ Baseline ${VERSION}-reqs created successfully"
else
  echo "❌ Baseline creation failed"
  exit 1
fi
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass: `npm test`
5. Submit a pull request

## License

ISC

---

**SpecForge CLI** - Forging specifications into reality, one phase at a time.