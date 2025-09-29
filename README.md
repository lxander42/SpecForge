# SpecForge CLI

> "Where specs are hammered into real hardware."

SpecForge is a hardware specification CLI that bridges the gap between innovation and manufacturing. It guides teams from idea through prototype to production with structured templates, BOM tracking, and maturity gates.

## Features

- **Interactive Project Initialization**: Set up hardware projects with structured phases and disciplines
- **GitHub Integration**: Automatically create labels, milestones, and project boards
- **Requirements Management**: Version-controlled functional requirements with baseline tracking
- **AI-Assisted Workflow**: Intelligent task pruning and requirement drafting (with guardrails)
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Prerequisites

- Node.js 20+
- GitHub Personal Access Token in `GITHUB_TOKEN` environment variable

## Installation

```bash
npm install -g specforge
```

## Quick Start

### Initialize a new project
```bash
specforge init --org your-org --repo your-repo \
  --disciplines Mechanical Electrical Firmware \
  --complexity medium
```

### Re-run safely (idempotent)
```bash
specforge plan --json
specforge refactor --reconcile --prune --json
```

### Requirements baseline
```bash
specforge baseline --approve --tag v0.1-reqs
```

## Commands

- `init` - Initialize a new hardware project
- `plan` - Regenerate WBS and requirements previews  
- `refactor` - Reconcile existing project state
- `baseline` - Approve and tag requirements baseline
- `labels` - Ensure required labels and milestones exist

## AI Usage Policy

- ✅ AI prunes checklists and drafts requirement text
- ❌ AI never designs components, performs FEA, or creates schematics/PCBs
- ❌ AI never makes engineering judgment calls on safety or verification

## License

ISC