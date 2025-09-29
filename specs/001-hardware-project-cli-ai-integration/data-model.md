# Data Model: Hardware Project CLI

## Entities

### Project
- id (slug)
- org
- repo
- disciplines [Mechanical|Electrical|Firmware|Software]
- complexity [low|medium|high]
- constitution (path)

### Phase
- key [concept|prelim|detailed|critical|final]
- gateCriteria (list)
- milestoneId (GitHub)

### RequirementsPackage
- path
- version (semver)
- baselineTag
- sections { functional, performance, environmental, interfaces, safety, verification, acceptance }

### Requirement
- id
- section
- text
- acceptanceCriteria
- verificationMethod

### WbsItem
- id (issue slug)
- title
- phase
- disciplineTags
- aiAssistable (boolean)
- aiHint (optional)
- dependencies [WbsItem.id]

### Baseline
- tag
- date
- approver
- changeLogRef

### ChangeLog
- path
- entries [ { id, type [added|changed|removed], summary } ]

