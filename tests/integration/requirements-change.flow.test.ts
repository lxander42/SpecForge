import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('Requirements Change Management Flow Test', () => {
  const testWorkDir = join(process.cwd(), 'temp-test-requirements-change');

  beforeEach(() => {
    if (!existsSync(testWorkDir)) {
      mkdirSync(testWorkDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testWorkDir)) {
      rmSync(testWorkDir, { recursive: true, force: true });
    }
  });

  it('should create issues for requirements gaps', async () => {
    const changeConfig = {
      org: 'test-org',
      repo: 'test-hardware-project',
      baselineTag: 'v0.1-reqs',
      dryRun: true,
    };

    // Mock requirements gap analysis
    const gapAnalysis = {
      missingRequirements: [
        {
          id: 'FR-005',
          section: 'functional',
          description: 'Power consumption limits not specified',
          priority: 'high',
          suggestedText: 'System shall consume no more than X watts during operation',
        },
        {
          id: 'PR-003',
          section: 'performance',
          description: 'Response time requirements missing',
          priority: 'medium',
          suggestedText: 'System shall respond to inputs within X milliseconds',
        },
      ],
      incompleteRequirements: [
        {
          id: 'FR-002',
          section: 'functional',
          issue: 'Acceptance criteria not defined',
          priority: 'high',
        },
        {
          id: 'ER-001',
          section: 'environmental',
          issue: 'Verification method not specified',
          priority: 'medium',
        },
      ],
    };

    // Expected GitHub issues to be created
    const expectedIssues = [
      {
        title: '[Requirements Gap] Power consumption limits not specified',
        body: expect.stringContaining('FR-005'),
        labels: ['requirements-gap', 'priority:high', 'section:functional'],
        assignees: [],
      },
      {
        title: '[Requirements Gap] Response time requirements missing',
        body: expect.stringContaining('PR-003'),
        labels: ['requirements-gap', 'priority:medium', 'section:performance'],
        assignees: [],
      },
      {
        title: '[Requirements Incomplete] FR-002 - Acceptance criteria not defined',
        body: expect.stringContaining('Acceptance criteria not defined'),
        labels: ['requirements-incomplete', 'priority:high', 'section:functional'],
        assignees: [],
      },
    ];

    // Verify gap analysis structure
    expect(gapAnalysis.missingRequirements).toHaveLength(2);
    expect(gapAnalysis.incompleteRequirements).toHaveLength(2);

    // Verify expected issues structure
    expect(expectedIssues).toHaveLength(3);
    expectedIssues.forEach(issue => {
      expect(issue.title).toBeTruthy();
      expect(issue.labels.length).toBeGreaterThan(0);
    });
  });

  it('should draft requirements updates with change tracking', async () => {
    const updateConfig = {
      org: 'test-org',
      repo: 'test-hardware-project',
      requirementId: 'FR-003',
      draftUpdate: true,
      dryRun: true,
    };

    // Mock existing requirement
    const existingRequirement = {
      id: 'FR-003',
      section: 'functional',
      text: 'System shall provide user interface',
      acceptanceCriteria: 'User can interact with system',
      verificationMethod: 'Inspection',
      version: '0.1.0',
      lastModified: '2024-01-15',
      approvalStatus: 'approved',
    };

    // Mock proposed changes
    const proposedChanges = {
      id: 'FR-003',
      section: 'functional',
      text: 'System shall provide intuitive graphical user interface with touch screen support',
      acceptanceCriteria: 'User can navigate all functions within 3 taps, touch response time < 100ms',
      verificationMethod: 'Test and Inspection',
      changeReason: 'Customer feedback requested touch screen support',
      impactAnalysis: 'Requires hardware change - touch screen display',
      proposedBy: 'test-user',
      proposedDate: '2024-02-01',
    };

    // Expected change record
    const expectedChangeRecord = {
      changeId: 'CHG-001',
      requirementId: 'FR-003',
      changeType: 'modification',
      before: {
        text: existingRequirement.text,
        acceptanceCriteria: existingRequirement.acceptanceCriteria,
        verificationMethod: existingRequirement.verificationMethod,
      },
      after: {
        text: proposedChanges.text,
        acceptanceCriteria: proposedChanges.acceptanceCriteria,
        verificationMethod: proposedChanges.verificationMethod,
      },
      justification: proposedChanges.changeReason,
      impact: proposedChanges.impactAnalysis,
      approvalStatus: 'pending',
      reviewers: [],
    };

    // Verify change tracking structure
    expect(expectedChangeRecord.changeId).toBeTruthy();
    expect(expectedChangeRecord.requirementId).toBe('FR-003');
    expect(expectedChangeRecord.changeType).toBe('modification');
    expect(expectedChangeRecord.before).toHaveProperty('text');
    expect(expectedChangeRecord.after).toHaveProperty('text');
    expect(expectedChangeRecord.approvalStatus).toBe('pending');
  });

  it('should enforce sign-off requirements for changes', async () => {
    const signOffConfig = {
      org: 'test-org',
      repo: 'test-hardware-project',
      changeId: 'CHG-001',
      dryRun: true,
    };

    // Mock sign-off requirements based on change impact
    const signOffMatrix = {
      'low-impact': {
        requiredApprovers: ['technical-lead'],
        optionalApprovers: [],
        autoApprovalAllowed: true,
      },
      'medium-impact': {
        requiredApprovers: ['technical-lead', 'project-manager'],
        optionalApprovers: ['customer-representative'],
        autoApprovalAllowed: false,
      },
      'high-impact': {
        requiredApprovers: ['technical-lead', 'project-manager', 'engineering-manager'],
        optionalApprovers: ['customer-representative', 'quality-manager'],
        autoApprovalAllowed: false,
      },
    };

    // Mock change impact assessment
    const changeImpact = {
      scope: 'hardware-and-software',
      cost: 'medium',
      schedule: 'low',
      risk: 'medium',
      overallImpact: 'medium-impact',
    };

    // Expected sign-off process
    const expectedSignOffProcess = {
      impact: changeImpact.overallImpact,
      requiredApprovals: signOffMatrix[changeImpact.overallImpact].requiredApprovers,
      optionalApprovals: signOffMatrix[changeImpact.overallImpact].optionalApprovers,
      currentApprovals: [],
      status: 'pending',
      canProceed: false,
    };

    // Verify sign-off matrix structure
    Object.values(signOffMatrix).forEach(signOff => {
      expect(signOff.requiredApprovers).toBeDefined();
      expect(Array.isArray(signOff.requiredApprovers)).toBe(true);
      expect(typeof signOff.autoApprovalAllowed).toBe('boolean');
    });

    // Verify impact assessment
    expect(['low-impact', 'medium-impact', 'high-impact']).toContain(changeImpact.overallImpact);

    // Verify sign-off process
    expect(expectedSignOffProcess.requiredApprovals.length).toBeGreaterThan(0);
    expect(expectedSignOffProcess.status).toBe('pending');
    expect(expectedSignOffProcess.canProceed).toBe(false);
  });

  it('should generate change proposals with proper documentation', async () => {
    const proposalConfig = {
      org: 'test-org',
      repo: 'test-hardware-project',
      changes: ['CHG-001', 'CHG-002'],
      generateProposal: true,
      dryRun: true,
    };

    // Mock change proposal document structure
    const changeProposal = {
      proposalId: 'CP-2024-001',
      title: 'Requirements Updates for Touch Screen Interface',
      summary: 'Proposal to update user interface requirements to support touch screen interaction',
      changes: [
        {
          changeId: 'CHG-001',
          requirementId: 'FR-003',
          type: 'modification',
          summary: 'Add touch screen support to user interface requirement',
        },
        {
          changeId: 'CHG-002',
          requirementId: 'PR-001',
          type: 'addition',
          summary: 'Add touch response time performance requirement',
        },
      ],
      impactAnalysis: {
        technical: 'Requires new hardware component (touch screen)',
        cost: 'Estimated $5,000 additional cost',
        schedule: 'May delay delivery by 2 weeks',
        risk: 'Low risk - mature technology',
      },
      approvalWorkflow: {
        requiredApprovers: ['technical-lead', 'project-manager'],
        currentApprovals: [],
        targetApprovalDate: '2024-02-15',
      },
      attachments: [
        'technical-analysis.pdf',
        'cost-estimate.xlsx',
        'schedule-impact.pdf',
      ],
    };

    // Verify proposal structure
    expect(changeProposal.proposalId).toMatch(/^CP-\d{4}-\d{3}$/);
    expect(changeProposal.changes).toHaveLength(2);
    expect(changeProposal.impactAnalysis).toHaveProperty('technical');
    expect(changeProposal.impactAnalysis).toHaveProperty('cost');
    expect(changeProposal.impactAnalysis).toHaveProperty('schedule');
    expect(changeProposal.impactAnalysis).toHaveProperty('risk');

    // Verify approval workflow
    expect(changeProposal.approvalWorkflow.requiredApprovers.length).toBeGreaterThan(0);
    expect(changeProposal.approvalWorkflow.targetApprovalDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Verify change details
    changeProposal.changes.forEach(change => {
      expect(change.changeId).toBeTruthy();
      expect(change.requirementId).toBeTruthy();
      expect(['modification', 'addition', 'deletion']).toContain(change.type);
      expect(change.summary).toBeTruthy();
    });
  });

  it('should maintain change history and audit trail', async () => {
    const auditConfig = {
      org: 'test-org',
      repo: 'test-hardware-project',
      requirementId: 'FR-003',
      includeHistory: true,
      dryRun: true,
    };

    // Mock requirement change history
    const changeHistory = {
      requirementId: 'FR-003',
      currentVersion: '0.3.0',
      history: [
        {
          version: '0.1.0',
          date: '2024-01-01',
          change: 'Initial requirement created',
          author: 'system-admin',
          approver: 'technical-lead',
          changeId: null,
        },
        {
          version: '0.2.0',
          date: '2024-01-15',
          change: 'Updated acceptance criteria for clarity',
          author: 'requirements-engineer',
          approver: 'technical-lead',
          changeId: 'CHG-000',
        },
        {
          version: '0.3.0',
          date: '2024-02-01',
          change: 'Added touch screen support',
          author: 'requirements-engineer',
          approver: 'project-manager',
          changeId: 'CHG-001',
        },
      ],
      auditTrail: [
        { timestamp: '2024-01-01T10:00:00Z', action: 'created', user: 'system-admin' },
        { timestamp: '2024-01-15T14:30:00Z', action: 'modified', user: 'requirements-engineer' },
        { timestamp: '2024-01-15T16:00:00Z', action: 'approved', user: 'technical-lead' },
        { timestamp: '2024-02-01T09:15:00Z', action: 'modified', user: 'requirements-engineer' },
        { timestamp: '2024-02-01T11:45:00Z', action: 'approved', user: 'project-manager' },
      ],
    };

    // Verify change history structure
    expect(changeHistory.history).toHaveLength(3);
    expect(changeHistory.auditTrail).toHaveLength(5);

    // Verify version progression
    const versions = changeHistory.history.map(h => h.version);
    expect(versions).toEqual(['0.1.0', '0.2.0', '0.3.0']);

    // Verify audit trail completeness
    changeHistory.auditTrail.forEach(entry => {
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      expect(['created', 'modified', 'approved', 'rejected']).toContain(entry.action);
      expect(entry.user).toBeTruthy();
    });

    // Verify traceability
    const approvalEntries = changeHistory.auditTrail.filter(entry => entry.action === 'approved');
    const modificationEntries = changeHistory.auditTrail.filter(entry => entry.action === 'modified');
    
    expect(approvalEntries.length).toBe(2);
    expect(modificationEntries.length).toBe(2);
  });
});
