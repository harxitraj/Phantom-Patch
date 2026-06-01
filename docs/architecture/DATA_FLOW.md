# Data Flow — Phantom Patch

> This document traces how data moves through the system from a GitHub webhook to a completed Pull Request.

---

## Table of Contents

- [End-to-End Flow](#end-to-end-flow)
- [Stage 1: Webhook Reception](#stage-1-webhook-reception)
- [Stage 2: Repository Cloning](#stage-2-repository-cloning)
- [Stage 3: Vulnerability Analysis](#stage-3-vulnerability-analysis)
- [Stage 4: Triage & Prioritization](#stage-4-triage--prioritization)
- [Stage 5: Exploit Verification](#stage-5-exploit-verification)
- [Stage 6: Patch Generation](#stage-6-patch-generation)
- [Stage 7: Patch Validation](#stage-7-patch-validation)
- [Stage 8: Pull Request Creation](#stage-8-pull-request-creation)
- [Data Persistence Points](#data-persistence-points)
- [Error Flow](#error-flow)

---

## End-to-End Flow

```
GitHub Push Event
       │
       ▼
┌──────────────┐   Payload: { repo, ref, commits, sender }
│   Webhook    │──────────────────────────────────────────────┐
│   Receiver   │                                              │
└──────┬───────┘                                              │
       │                                                      │
       ▼                                                      ▼
┌──────────────┐   Creates workflow record              ┌──────────┐
│ Orchestrator │──────────────────────────────────────▶ │ MongoDB  │
│              │                                        │          │
└──────┬───────┘                                        └──────────┘
       │                                                      ▲
       ▼                                                      │
┌──────────────┐   Runs Semgrep + LLM analysis                │
│  Analysis    │   Output: vulnerability findings[]           │
│  Agent       │──────────────────────────────────────────────┤
└──────┬───────┘                                              │
       │                                                      │
       ▼                                                      │
┌──────────────┐   Filters false positives                    │
│   Triage     │   Output: prioritized findings[]             │
│   Agent      │──────────────────────────────────────────────┤
└──────┬───────┘                                              │
       │                                                      │
       ▼                                                      │
┌──────────────┐   Docker sandbox testing                     │
│  Exploit     │   Output: verified vulns + evidence          │
│  Agent       │──────────────────────────────────────────────┤
└──────┬───────┘                                              │
       │                                                      │
       ▼                                                      │
┌──────────────┐   LLM-generated secure fix                   │
│   Patch      │   Output: code diff + explanation            │
│   Agent      │──────────────────────────────────────────────┤
└──────┬───────┘                                              │
       │                                                      │
       ▼                                                      │
┌──────────────┐   Test suite + security re-scan              │
│ Validation   │   Output: pass/fail + confidence score       │
│   Agent      │──────────────────────────────────────────────┤
└──────┬───────┘                                              │
       │                                                      │
       ▼                                                      │
┌──────────────┐   Branch, commit, push, open PR              │
│   GitOps     │   Output: PR URL + metadata                  │
│   Agent      │──────────────────────────────────────────────┘
└──────┬───────┘
       │
       ▼
  Pull Request Created ✓
```

---

## Stage 1: Webhook Reception

**Trigger:** GitHub sends an HTTP POST to `/api/webhooks/github`

**Incoming data:**
```json
{
    "action": "push",
    "ref": "refs/heads/main",
    "repository": {
        "full_name": "acme-corp/web-app",
        "clone_url": "https://github.com/acme-corp/web-app.git",
        "default_branch": "main"
    },
    "sender": { "login": "developer123" },
    "head_commit": {
        "id": "abc123def456",
        "message": "Add user search endpoint",
        "added": ["src/routes/search.js"],
        "modified": ["src/controllers/userController.js"]
    }
}
```

**Processing:**
1. Verify webhook signature (HMAC-SHA256)
2. Check if repository is registered for monitoring
3. Extract relevant fields into internal format
4. Emit `workflow:start` event

**Transformed output → Orchestrator:**
```json
{
    "event": "push",
    "repository": {
        "owner": "acme-corp",
        "name": "web-app",
        "fullName": "acme-corp/web-app",
        "cloneUrl": "https://github.com/acme-corp/web-app.git",
        "defaultBranch": "main"
    },
    "trigger": {
        "ref": "refs/heads/main",
        "commitSha": "abc123def456",
        "actor": "developer123",
        "changedFiles": [
            "src/routes/search.js",
            "src/controllers/userController.js"
        ]
    }
}
```

**Persisted:** New `agent_runs` document (status: PENDING)

---

## Stage 2: Repository Cloning

**Performed by:** Orchestrator Agent

**Action:** Clone or pull the target repository to a temporary working directory.

```
Target: /tmp/phantom-patch/workflows/{workflowId}/acme-corp/web-app/
```

**What happens:**
1. Create workflow-scoped temp directory
2. `git clone --depth 1 --branch main {cloneUrl}` (shallow clone for speed)
3. Verify clone integrity
4. Pass `repositoryPath` to the Analysis Agent

**Why shallow clone?** We only need the current state of the code for scanning, not the full history. Saves time and disk space.

---

## Stage 3: Vulnerability Analysis

**Agent:** Analysis Agent

**Data transformation:**

```
Input:  repositoryPath (local filesystem)
        ↓
        ├── Semgrep scan → raw findings[]
        ├── LLM analysis → additional findings[]
        ↓
        Merge + deduplicate
        ↓
Output: unified vulnerability report
```

**Semgrep raw output (simplified):**
```json
{
    "results": [
        {
            "check_id": "javascript.express.security.audit.sql-injection",
            "path": "src/controllers/userController.js",
            "start": { "line": 45, "col": 5 },
            "end": { "line": 45, "col": 72 },
            "extra": {
                "message": "Detected SQL injection",
                "severity": "ERROR",
                "metadata": { "cwe": ["CWE-89"] }
            }
        }
    ]
}
```

**Transformation to internal format:**
```json
{
    "id": "generated-uuid",
    "type": "SQL_INJECTION",
    "severity": "CRITICAL",
    "confidence": "HIGH",
    "filePath": "src/controllers/userController.js",
    "lineNumber": 45,
    "codeSnippet": "const query = `SELECT * FROM users WHERE id = ${req.params.id}`",
    "description": "User-controlled input directly interpolated into SQL query",
    "cweId": "CWE-89",
    "detectedBy": "semgrep"
}
```

**Persisted:** Each finding saved to `vulnerabilities` collection. Agent run updated in `agent_runs`.

---

## Stage 4: Triage & Prioritization

**Agent:** Triage Agent

**Data transformation:**

```
Input:  raw findings[] (from Analysis)
        ↓
        ├── Context analysis (code reachability, exposure)
        ├── Confidence evaluation
        ├── Scoring (severity × confidence × reachability × data_sensitivity × exposure)
        ↓
        ├── prioritized[] (score >= threshold)
        └── filtered[] (score < threshold, with reasons)
        ↓
Output: prioritized vulnerability list + filtered list
```

**What gets filtered:**
- Dead code (function defined but never called)
- Test-only code (vulnerability in test files)
- Already-mitigated (upstream middleware handles sanitization)
- Low-confidence detection (tool isn't sure)

**What moves forward:**
- High-confidence findings in production code paths
- Publicly accessible endpoints with unsanitized input
- Code handling sensitive data (auth, PII, payments)

**Persisted:** Triage scores and reasons updated on `vulnerabilities` documents.

---

## Stage 5: Exploit Verification

**Agent:** Exploit Agent (runs per vulnerability)

**Data transformation:**

```
Input:  single prioritized vulnerability
        ↓
        ├── Select exploit template by vuln type
        ├── Spin up Docker sandbox
        ├── Mount source code (read-only)
        ├── Execute exploit script
        ├── Capture stdout/stderr/exit code
        ├── Analyze results (did exploit succeed?)
        ├── Destroy container
        ↓
Output: exploit result + evidence
```

**Sandbox lifecycle:**

```
1. docker create (phantom-sandbox:latest, --network none, resource limits)
2. docker cp (source code → /app, exploit template → /exploit)
3. docker start
4. Wait for exit or timeout (30s)
5. docker logs (capture output)
6. docker rm -f (cleanup)
```

**Success criteria by vuln type:**

| Type | Exploit Succeeds When |
|------|----------------------|
| SQL Injection | Response contains data that should be restricted |
| XSS | Response body contains unescaped payload |
| Command Injection | Command output appears in response |
| Hardcoded Secrets | Secret value is accessible from code path |

**Persisted:** Exploit result saved to `exploit_results` collection. Vulnerability status updated.

---

## Stage 6: Patch Generation

**Agent:** Patch Agent (runs per verified vulnerability)

**Data transformation:**

```
Input:  verified vulnerability + exploit evidence + full file content
        ↓
        ├── Build LLM prompt with:
        │   ├── Vulnerability details
        │   ├── Exploit evidence (what the attacker did)
        │   ├── Full file content (for context)
        │   ├── Project dependencies (available libraries)
        │   └── Patch guidelines (minimal changes, preserve style)
        ├── LLM generates fix
        ├── Parse response into structured patch
        ├── Generate unified diff
        ↓
Output: patch object (original code, patched code, diff, explanation)
```

**LLM prompt structure (conceptual):**

```
You are a security engineer fixing a vulnerability.

VULNERABILITY:
- Type: SQL Injection (CWE-89)
- File: src/controllers/userController.js:45
- Code: const query = `SELECT * FROM users WHERE id = ${req.params.id}`

EXPLOIT EVIDENCE:
- Payload: ' OR 1=1; --
- Result: Returned all user records (expected: single user or 401)

FILE CONTENT:
[full file here]

AVAILABLE DEPENDENCIES:
- pg: ^8.11.0 (supports parameterized queries)

RULES:
1. Make minimal changes
2. Do not break existing functionality
3. Follow the existing code style
4. Prefer using existing dependencies

Generate a secure fix.
```

**Persisted:** Patch saved to `patches` collection, linked to vulnerability.

---

## Stage 7: Patch Validation

**Agent:** Validation Agent

**Data transformation:**

```
Input:  generated patch + repository path
        ↓
        ├── Apply patch to working copy
        ├── Run syntax check (file parses OK?)
        ├── Run existing tests (npm test)
        │   └── Capture: passed, failed, skipped counts
        ├── Run security re-scan (Semgrep on patched file)
        │   └── Check: original vuln gone? New vulns introduced?
        ├── Calculate confidence score
        ├── Revert patch (restore original for other patches)
        ↓
Output: validation report (passed/failed, confidence, details)
```

**Confidence calculation:**

```
base_score = 0.5

if syntax_check.passed:    base_score += 0.1
if tests.all_passed:       base_score += 0.2
if vuln_removed:           base_score += 0.15
if no_new_vulns:           base_score += 0.05

confidence = min(base_score, 1.0)
```

**Persisted:** Validation results attached to patch document.

---

## Stage 8: Pull Request Creation

**Agent:** GitOps Agent

**Data transformation:**

```
Input:  all validated patches + repository info
        ↓
        ├── Create branch: phantom-patch/fix-{type}-{hash}
        ├── For each patch:
        │   ├── Apply patch to file
        │   ├── Stage changes (git add)
        │   └── Commit with structured message
        ├── Push branch to GitHub
        ├── Create PR via GitHub API
        │   ├── Title: fix(security): patch {vuln_type} in {filename}
        │   ├── Body: vulnerability details + evidence + validation results
        │   └── Labels: security, automated-fix, phantom-patch
        ↓
Output: PR URL + metadata
```

**GitHub API calls:**

```
1. POST /repos/{owner}/{repo}/git/refs          → create branch ref
2. PUT  /repos/{owner}/{repo}/contents/{path}    → update file (per patch)
3. POST /repos/{owner}/{repo}/pulls              → create PR
4. POST /repos/{owner}/{repo}/issues/{pr}/labels → add labels
```

**Persisted:** PR record saved to `pull_requests` collection. Workflow marked COMPLETED.

---

## Data Persistence Points

Every stage persists its results. Here's where data lands:

| Stage | Collection | What's Stored |
|-------|-----------|---------------|
| Webhook received | `agent_runs` | Workflow record (status: PENDING) |
| Analysis complete | `vulnerabilities`, `agent_runs` | Findings, scan metadata |
| Triage complete | `vulnerabilities` (updated), `agent_runs` | Scores, filter reasons |
| Exploit complete | `exploit_results`, `agent_runs` | Evidence, sandbox info |
| Patch complete | `patches`, `agent_runs` | Code diff, explanation |
| Validation complete | `patches` (updated), `agent_runs` | Test results, confidence |
| PR created | `pull_requests`, `agent_runs` | PR URL, branch, commits |
| Any stage | `audit_logs` | Every significant action |

---

## Error Flow

When something goes wrong, data still flows — just differently:

```
Agent execution fails
       │
       ▼
┌──────────────┐
│ Agent reports │──▶ Error details persisted to agent_runs
│ failure       │──▶ Audit log entry created
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Orchestrator  │──▶ Checks retry policy
│ evaluates     │
└──────┬───────┘
       │
       ├── Retries remaining? ──▶ Re-dispatch agent
       │
       ├── Critical agent? ──▶ Abort workflow, status: FAILED
       │
       └── Non-critical? ──▶ Skip stage, continue with flag
```

**Retry data:**
```json
{
    "agentName": "analysis",
    "attempt": 2,
    "maxAttempts": 3,
    "lastError": "Semgrep process timed out after 60s",
    "nextRetryAt": "ISO-8601",
    "backoffMs": 3000
}
```

All error data is persisted for debugging and monitoring through the dashboard.
