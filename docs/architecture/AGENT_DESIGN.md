# Agent Design Specification — Phantom Patch

> Each agent is a self-contained module with a defined contract. This document specifies what each agent does, what it expects, and what it produces.

---

## Table of Contents

- [BaseAgent Contract](#baseagent-contract)
- [Agent 1: Orchestrator](#agent-1-orchestrator)
- [Agent 2: Analysis Agent](#agent-2-analysis-agent)
- [Agent 3: Triage Agent](#agent-3-triage-agent)
- [Agent 4: Exploit Agent](#agent-4-exploit-agent)
- [Agent 5: Patch Agent](#agent-5-patch-agent)
- [Agent 6: Validation Agent](#agent-6-validation-agent)
- [Agent 7: GitOps Agent](#agent-7-gitops-agent)
- [Agent Comparison Matrix](#agent-comparison-matrix)

---

## BaseAgent Contract

Every agent extends `BaseAgent`. This enforces consistency and makes agents testable in isolation.

```javascript
class BaseAgent {
    name          // string — unique agent identifier
    config        // object — agent-specific configuration
    status        // enum: 'idle' | 'initializing' | 'running' | 'completed' | 'failed'
    logger        // Winston logger instance (child logger with agent context)

    async initialize(context)  // Setup, validate dependencies
    async execute(input)       // Core logic — override per agent
    async report(result)       // Persist results, emit events
    async teardown()           // Cleanup resources
}
```

### Common Execution Context

Every agent receives a shared context object:

```json
{
    "workflowId": "uuid-v4",
    "repositoryId": "mongo-object-id",
    "repository": {
        "owner": "github-org",
        "name": "repo-name",
        "fullName": "github-org/repo-name",
        "cloneUrl": "https://github.com/...",
        "defaultBranch": "main"
    },
    "trigger": {
        "type": "push | pull_request | manual",
        "ref": "refs/heads/main",
        "commitSha": "abc123...",
        "actor": "github-username"
    },
    "timestamp": "2026-01-01T00:00:00.000Z"
}
```

### State Transitions

```
IDLE ──▶ INITIALIZING ──▶ RUNNING ──▶ COMPLETED
                │              │
                └──▶ FAILED ◀──┘
```

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Initialization failure | Status → FAILED, skip execution |
| Execution timeout | Status → FAILED, cleanup resources |
| Execution error | Retry up to `maxRetries`, then FAILED |
| External service down | Retry with backoff, then FAILED |

Default retry policy: 2 retries, exponential backoff (1s, 3s).

---

## Agent 1: Orchestrator

### Role
Central coordinator that manages the entire vulnerability remediation pipeline.

### Responsibilities
- Receive incoming workflow triggers (webhook events, manual scans)
- Create workflow execution records in the database
- Dispatch tasks to agents in the correct order
- Track workflow state through the state machine
- Handle agent failures (retry, skip, or abort)
- Emit dashboard update events at each stage

### Input

```json
{
    "event": "push | pull_request | manual_scan",
    "payload": {
        "repository": { "owner": "...", "name": "..." },
        "ref": "refs/heads/main",
        "commits": [],
        "sender": { "login": "..." }
    }
}
```

### Output

```json
{
    "workflowId": "uuid-v4",
    "status": "completed | failed | partial",
    "startedAt": "ISO-8601",
    "completedAt": "ISO-8601",
    "stages": {
        "analysis": { "status": "completed", "duration": 12340 },
        "triage": { "status": "completed", "duration": 3210 },
        "exploit": { "status": "completed", "duration": 45670 },
        "patch": { "status": "completed", "duration": 8900 },
        "validation": { "status": "completed", "duration": 5430 },
        "gitops": { "status": "completed", "duration": 4210 }
    },
    "summary": {
        "vulnerabilitiesFound": 5,
        "vulnerabilitiesVerified": 3,
        "patchesGenerated": 3,
        "patchesValidated": 2,
        "pullRequestsCreated": 1
    }
}
```

### State Machine Logic

```
on webhook_received:
    create workflow record
    clone repository
    dispatch → Analysis Agent

on analysis:complete(vulnReport):
    if vulnReport.findings.length === 0:
        mark workflow COMPLETED (no issues found)
    else:
        dispatch → Triage Agent

on triage:complete(prioritizedList):
    if prioritizedList.length === 0:
        mark workflow COMPLETED (all filtered out)
    else:
        for each vulnerability:
            dispatch → Exploit Agent

on exploit:complete(exploitResult):
    if exploitResult.verified:
        dispatch → Patch Agent
    else:
        mark vulnerability as FALSE_POSITIVE

on patch:complete(generatedPatch):
    dispatch → Validation Agent

on validation:complete(validationReport):
    if validationReport.passed:
        collect all validated patches
        dispatch → GitOps Agent
    else:
        mark patch as FAILED, log reason

on gitops:complete(pullRequest):
    mark workflow COMPLETED
    update dashboard
```

### Dependencies
- All other agents (dispatches to them)
- Event Bus (listens and emits events)
- MongoDB (workflow state persistence)

---

## Agent 2: Analysis Agent

### Role
Security vulnerability detector. Scans source code using static analysis tools and LLM-based code review.

### Responsibilities
- Run Semgrep with security-focused rulesets
- Send code snippets to OpenAI for deeper analysis
- Combine results into a unified vulnerability report
- Deduplicate findings across tools

### Input

```json
{
    "workflowId": "uuid-v4",
    "repositoryPath": "/tmp/repos/workflow-id/repo-name",
    "scanConfig": {
        "languages": ["javascript", "python"],
        "rulesets": ["owasp-top-10", "cwe-top-25"],
        "excludePaths": ["node_modules", "vendor", "test"],
        "maxFileSize": 1048576
    }
}
```

### Output

```json
{
    "workflowId": "uuid-v4",
    "scanDuration": 12340,
    "filesScanned": 142,
    "findings": [
        {
            "id": "vuln-uuid-v4",
            "type": "SQL_INJECTION",
            "severity": "CRITICAL",
            "confidence": "HIGH",
            "filePath": "src/controllers/userController.js",
            "lineNumber": 45,
            "endLineNumber": 48,
            "codeSnippet": "const query = `SELECT * FROM users WHERE id = ${req.params.id}`",
            "description": "User-controlled input directly interpolated into SQL query string",
            "cweId": "CWE-89",
            "detectedBy": "semgrep",
            "rule": "javascript.express.security.audit.sql-injection"
        }
    ],
    "summary": {
        "critical": 1,
        "high": 2,
        "medium": 3,
        "low": 1,
        "info": 0
    }
}
```

### Detection Strategy by Vulnerability Type

| Type | Semgrep Rules | LLM Analysis Focus |
|------|--------------|---------------------|
| SQL Injection | `javascript.express.security.audit.sql-injection` | String concatenation in query builders |
| XSS | `javascript.express.security.audit.xss` | Unescaped output rendering |
| Hardcoded Secrets | `generic.secrets.security.detected-*` | API key / token format patterns |
| Command Injection | `javascript.lang.security.audit.child-process` | Unsanitized input to exec/spawn |

### Dependencies
- Semgrep CLI
- OpenAI API
- Local filesystem (cloned repo)

---

## Agent 3: Triage Agent

### Role
False positive filter and vulnerability prioritizer. Reduces noise by analyzing context and exploitability.

### Responsibilities
- Evaluate each finding's exploitability in its specific context
- Filter out low-confidence or clearly-false findings
- Score and rank remaining vulnerabilities
- Group related findings that share a root cause

### Input

```json
{
    "workflowId": "uuid-v4",
    "findings": [
        {
            "id": "vuln-uuid",
            "type": "SQL_INJECTION",
            "severity": "CRITICAL",
            "confidence": "HIGH",
            "filePath": "...",
            "lineNumber": 45,
            "codeSnippet": "...",
            "description": "...",
            "detectedBy": "semgrep"
        }
    ],
    "repositoryContext": {
        "hasTestSuite": true,
        "framework": "express",
        "dependencyCount": 45
    }
}
```

### Output

```json
{
    "workflowId": "uuid-v4",
    "triageDuration": 3210,
    "originalCount": 7,
    "filteredCount": 4,
    "prioritized": [
        {
            "id": "vuln-uuid",
            "type": "SQL_INJECTION",
            "severity": "CRITICAL",
            "confidence": "HIGH",
            "triageScore": 9.2,
            "triageReason": "Direct user input flows into raw SQL query with no sanitization. Route is publicly accessible.",
            "exploitLikelihood": "HIGH",
            "businessImpact": "Data breach — full database read access",
            "recommendedAction": "EXPLOIT_VERIFY"
        }
    ],
    "filtered": [
        {
            "id": "vuln-uuid-2",
            "filterReason": "Dead code — function is defined but never called",
            "originalSeverity": "MEDIUM"
        }
    ]
}
```

### Triage Scoring Criteria

| Factor | Weight | Description |
|--------|--------|-------------|
| Severity | 30% | CVSS-aligned severity rating |
| Confidence | 25% | Detection tool's confidence level |
| Reachability | 20% | Is the vulnerable code reachable from user input? |
| Data sensitivity | 15% | Does the code handle PII, auth, or financial data? |
| Exposure | 10% | Is the endpoint publicly accessible? |

### Dependencies
- OpenAI API (contextual analysis)

---

## Agent 4: Exploit Agent

### Role
Red Team verification. Proves whether a vulnerability is actually exploitable through controlled testing in a sandboxed environment.

### Responsibilities
- Select the right exploit template based on vulnerability type
- Spin up an isolated Docker container
- Execute exploit script against the vulnerable code
- Capture evidence (stdout, stderr, response codes)
- Report exploit success/failure with proof
- Destroy the sandbox after completion

### Input

```json
{
    "workflowId": "uuid-v4",
    "vulnerability": {
        "id": "vuln-uuid",
        "type": "SQL_INJECTION",
        "filePath": "src/controllers/userController.js",
        "lineNumber": 45,
        "codeSnippet": "..."
    },
    "repositoryPath": "/tmp/repos/workflow-id/repo-name",
    "sandboxConfig": {
        "timeout": 30000,
        "memoryLimit": "256m",
        "cpuLimit": "0.5",
        "networkMode": "none"
    }
}
```

### Output

```json
{
    "workflowId": "uuid-v4",
    "vulnerabilityId": "vuln-uuid",
    "exploitDuration": 4560,
    "verified": true,
    "exploitResult": {
        "success": true,
        "payload": "' OR 1=1; --",
        "evidence": {
            "statusCode": 200,
            "responseContains": "admin@company.com",
            "expectedBehavior": "Should return 401 or empty result",
            "actualBehavior": "Returned all user records"
        },
        "riskScore": 9.5,
        "exploitTemplate": "sql-injection/auth-bypass.js"
    },
    "sandboxInfo": {
        "containerId": "abc123...",
        "imageUsed": "phantom-sandbox:latest",
        "exitCode": 0,
        "cleaned": true
    }
}
```

### Exploit Templates (v1)

| Vulnerability | Template | What It Tests |
|--------------|----------|---------------|
| SQL Injection | `sql-injection/auth-bypass.js` | Authentication bypass via tautology |
| SQL Injection | `sql-injection/data-extraction.js` | Unauthorized data access |
| XSS | `xss/reflected-xss.js` | Script injection in response |
| XSS | `xss/stored-xss.js` | Persistent script injection |
| Command Injection | `cmd-injection/basic-exec.js` | Command execution via input |
| Hardcoded Secrets | `secrets/exposure-check.js` | Secret reachability analysis |

### Safety Constraints

1. **No network access** — Container runs with `--network none`
2. **No persistent storage** — Ephemeral storage only
3. **Time-boxed** — Hard 30s timeout, container killed on expiry
4. **Template-only** — No dynamic exploit generation, only predefined scripts
5. **Evidence capture** — All I/O logged for audit

### Dependencies
- Docker (dockerode)
- Exploit template files
- Local filesystem (cloned repo)

---

## Agent 5: Patch Agent

### Role
Blue Team remediation. Generates secure code patches for verified vulnerabilities.

### Responsibilities
- Analyze the vulnerable code and surrounding context
- Generate a minimal, secure fix using LLM
- Ensure the patch follows the project's coding style
- Produce a diff-format patch for direct application

### Input

```json
{
    "workflowId": "uuid-v4",
    "vulnerability": {
        "id": "vuln-uuid",
        "type": "SQL_INJECTION",
        "filePath": "src/controllers/userController.js",
        "lineNumber": 45,
        "codeSnippet": "const query = `SELECT * FROM users WHERE id = ${req.params.id}`"
    },
    "exploitEvidence": {
        "payload": "' OR 1=1; --",
        "actualBehavior": "Returned all user records"
    },
    "fileContent": "// full file content for context",
    "projectContext": {
        "language": "javascript",
        "framework": "express",
        "dependencies": { "pg": "^8.11.0" }
    }
}
```

### Output

```json
{
    "workflowId": "uuid-v4",
    "vulnerabilityId": "vuln-uuid",
    "patchDuration": 8900,
    "patch": {
        "filePath": "src/controllers/userController.js",
        "originalCode": "const query = `SELECT * FROM users WHERE id = ${req.params.id}`;\nconst result = await db.query(query);",
        "patchedCode": "const query = 'SELECT * FROM users WHERE id = $1';\nconst result = await db.query(query, [req.params.id]);",
        "diffContent": "--- a/src/controllers/userController.js\n+++ b/src/controllers/userController.js\n@@ -44,2 +44,2 @@\n-const query = `SELECT * FROM users WHERE id = ${req.params.id}`;\n-const result = await db.query(query);\n+const query = 'SELECT * FROM users WHERE id = $1';\n+const result = await db.query(query, [req.params.id]);",
        "explanation": "Replaced string interpolation with parameterized query. User input now passed as a separate parameter, preventing SQL injection."
    },
    "confidence": 0.92,
    "additionalNotes": "No new dependencies required. Existing pg driver supports parameterized queries natively."
}
```

### Patch Strategy by Vulnerability Type

| Type | Strategy | Example Fix |
|------|----------|-------------|
| SQL Injection | Parameterized queries | `db.query('SELECT * FROM users WHERE id = $1', [id])` |
| XSS | Sanitization + encoding | `const safe = escapeHtml(userInput)` |
| Hardcoded Secrets | Move to env vars | `const key = process.env.API_KEY` |
| Command Injection | Validation + safe APIs | `execFile('cmd', [validated])` instead of `exec(input)` |

### Patch Quality Rules

1. **Minimal changes** — Only modify what's needed to fix the vulnerability
2. **Preserve functionality** — Fix must not break existing behavior
3. **Follow conventions** — Match the project's coding style
4. **No new dependencies** — Prefer using existing libraries
5. **Clear explanation** — Every patch includes a human-readable why

### Dependencies
- OpenAI API (patch generation)
- Local filesystem (read surrounding code)

---

## Agent 6: Validation Agent

### Role
Patch QA. Verifies that generated patches don't break functionality and actually fix the vulnerability.

### Responsibilities
- Apply the patch to the codebase
- Run existing test suites if available
- Run a security re-scan on patched code
- Calculate a confidence score

### Input

```json
{
    "workflowId": "uuid-v4",
    "patch": {
        "filePath": "src/controllers/userController.js",
        "originalCode": "...",
        "patchedCode": "..."
    },
    "vulnerability": {
        "id": "vuln-uuid",
        "type": "SQL_INJECTION"
    },
    "repositoryPath": "/tmp/repos/workflow-id/repo-name",
    "testConfig": {
        "testCommand": "npm test",
        "testTimeout": 120000,
        "runSecurityRescan": true
    }
}
```

### Output

```json
{
    "workflowId": "uuid-v4",
    "vulnerabilityId": "vuln-uuid",
    "validationDuration": 5430,
    "passed": true,
    "results": {
        "patchApplied": true,
        "existingTests": {
            "ran": true,
            "passed": 42,
            "failed": 0,
            "skipped": 3,
            "total": 45,
            "status": "PASS"
        },
        "securityRescan": {
            "ran": true,
            "originalVulnStillPresent": false,
            "newVulnsIntroduced": 0,
            "status": "PASS"
        },
        "syntaxCheck": {
            "ran": true,
            "status": "PASS"
        }
    },
    "confidenceScore": 0.95,
    "recommendation": "APPROVE"
}
```

### Validation Checks

| Check | Required | Criteria |
|-------|----------|----------|
| Syntax validation | Yes | Patched file parses without errors |
| Existing tests pass | Yes (if available) | No test regressions |
| Security re-scan | Yes | Original vulnerability gone |
| No new vulns | Yes | Patch doesn't introduce new issues |
| Code style check | No | Matches project lint rules (if configured) |

### Confidence Scoring

| Score Range | Meaning | Action |
|-------------|---------|--------|
| 0.9 – 1.0 | High confidence | Auto-approve for PR |
| 0.7 – 0.9 | Medium confidence | Approve with review flag |
| 0.5 – 0.7 | Low confidence | Manual review required |
| Below 0.5 | Very low | Reject, log for manual fix |

### Dependencies
- Test runners (npm test, pytest, etc.)
- Semgrep (re-scan)
- Local filesystem (apply patch)

---

## Agent 7: GitOps Agent

### Role
Repository automation. Takes validated patches and opens a GitHub Pull Request with full context.

### Responsibilities
- Create a fix branch from the default branch
- Apply patches as commits
- Push branch to GitHub
- Open a PR with detailed description
- Add appropriate labels

### Input

```json
{
    "workflowId": "uuid-v4",
    "repository": {
        "owner": "github-org",
        "name": "repo-name",
        "defaultBranch": "main"
    },
    "patches": [
        {
            "vulnerabilityId": "vuln-uuid",
            "vulnerabilityType": "SQL_INJECTION",
            "severity": "CRITICAL",
            "filePath": "src/controllers/userController.js",
            "patchedCode": "...",
            "explanation": "..."
        }
    ],
    "validationReport": {
        "passed": true,
        "confidenceScore": 0.95
    }
}
```

### Output

```json
{
    "workflowId": "uuid-v4",
    "pullRequest": {
        "number": 42,
        "url": "https://github.com/org/repo/pull/42",
        "title": "fix(security): patch SQL injection in userController.js",
        "branch": "phantom-patch/fix-sql-injection-abc123",
        "status": "open",
        "labels": ["security", "automated-fix", "phantom-patch"],
        "filesChanged": 1,
        "additions": 2,
        "deletions": 2
    },
    "commits": [
        {
            "sha": "def456...",
            "message": "fix: parameterize SQL query to prevent injection\n\nVulnerability: SQL Injection (CWE-89)\nSeverity: CRITICAL\nFile: src/controllers/userController.js:45"
        }
    ]
}
```

### PR Description Template

```markdown
## 🛡️ Security Fix — Automated by Phantom Patch

### Vulnerability Details
- **Type:** SQL Injection
- **Severity:** CRITICAL
- **CWE:** CWE-89
- **File:** `src/controllers/userController.js:45`

### What was found
User-controlled input directly interpolated into SQL query string,
allowing attackers to modify query logic.

### Exploit Evidence
- **Payload:** `' OR 1=1; --`
- **Result:** Authentication bypass — returned all user records

### What was fixed
Replaced string interpolation with parameterized query.
User input is now passed as a parameter, preventing injection.

### Validation Results
- ✅ Existing tests pass (42/42)
- ✅ Security re-scan clean
- ✅ No new vulnerabilities introduced
- 📊 Confidence Score: 95%

---
*This PR was created automatically by Phantom Patch*
```

### Branch Naming Convention

```
phantom-patch/fix-{vuln-type}-{short-hash}
```

Examples:
- `phantom-patch/fix-sql-injection-a1b2c3`
- `phantom-patch/fix-xss-d4e5f6`
- `phantom-patch/fix-hardcoded-secret-g7h8i9`

### Dependencies
- GitHub API (Octokit)
- Git operations (clone, branch, commit, push)

---

## Agent Comparison Matrix

| Agent | Trigger | Critical? | External Deps | Avg Duration | Retry Policy |
|-------|---------|-----------|---------------|-------------|-------------|
| Orchestrator | Webhook/Manual | Yes | No | — | N/A (coordinator) |
| Analysis | Orchestrator dispatch | Yes | Semgrep, OpenAI | 10-30s | 2 retries |
| Triage | Analysis complete | No | OpenAI | 3-10s | 2 retries |
| Exploit | Triage complete | Yes | Docker | 5-30s | 1 retry |
| Patch | Exploit verified | Yes | OpenAI | 5-15s | 2 retries |
| Validation | Patch generated | Yes | Test runners | 5-120s | 1 retry |
| GitOps | Validation passed | Yes | GitHub API | 3-10s | 2 retries |

**Critical agents** — if they fail, the workflow aborts. Non-critical agents (Triage) can be bypassed with appropriate logging.
