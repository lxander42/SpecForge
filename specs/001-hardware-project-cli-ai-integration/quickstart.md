## Quickstart: Hardware Project CLI

### Prerequisites
- Node.js 20+
- GitHub PAT in `GITHUB_TOKEN`

### Initialize a project
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

### AI usage
- AI prunes checklists and drafts requirement text.
- AI never designs components, performs FEA, or creates schematics/PCBs.

