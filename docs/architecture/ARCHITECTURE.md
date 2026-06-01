# System Architecture — Phantom Patch

> Last updated: Phase 1 — Architecture Design

---

## Table of Contents

- [1. System Overview](#1-system-overview)
- [2. Architecture Layers](#2-architecture-layers)
- [3. Multi-Agent System](#3-multi-agent-system)
- [4. Communication Patterns](#4-communication-patterns)
- [5. Security Architecture](#5-security-architecture)
- [6. Deployment Architecture](#6-deployment-architecture)
- [7. Scalability Considerations](#7-scalability-considerations)
- [8. Error Handling Strategy](#8-error-handling-strategy)

---

## 1. System Overview

Phantom Patch is a **three-tier event-driven system** built around a multi-agent pipeline. The system takes a GitHub webhook event as input and produces a verified Pull Request as output — fully autonomously.

### High-Level View

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL TRIGGERS                              │
│                    GitHub Webhooks / Manual Scan                        │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                             │
│                                                                          │
│   ┌────────────────┐  ┌──────────────┐  ┌────────────────────────┐      │
│   │   Dashboard    │  │  Vuln Reports │  │  Agent Status Monitor  │      │
│   │  (HTML/CSS/JS) │  │              │  │                        │      │
│   └────────────────┘  └──────────────┘  └────────────────────────┘      │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ REST API calls
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            API LAYER                                     │
│                        (Express.js Server)                               │
│                                                                          │
│   ┌────────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────┐   │
│   │  Webhook   │  │   Repo     │  │    Vuln      │  │    Auth      │   │
│   │  Receiver  │  │  Manager   │  │  Controller  │  │  Controller  │   │
│   └──────┬─────┘  └────────────┘  └──────────────┘  └──────────────┘   │
│          │                                                               │
└──────────┼───────────────────────────────────────────────────────────────┘
           │ Event dispatch
           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     AGENT ORCHESTRATION LAYER                           │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │                    Event Bus (EventEmitter)                   │      │
│   └──────┬──────────┬──────────┬───────────┬──────────┬─────────┘      │
│          │          │          │           │          │                   │
│          ▼          ▼          ▼           ▼          ▼                   │
│   ┌──────────┐┌─────────┐┌────────┐┌──────────┐┌──────────┐            │
│   │ Analysis ││ Triage  ││Exploit ││  Patch   ││Validation│            │
│   │  Agent   ││  Agent  ││ Agent  ││  Agent   ││  Agent   │            │
│   └──────────┘└─────────┘└────────┘└──────────┘└──────────┘            │
│                                                       │                  │
│                                                       ▼                  │
│                                              ┌──────────────┐           │
│                                              │  GitOps Agent │           │
│                                              └──────────────┘           │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
           ┌────────────────────┼───────────────────────┐
           ▼                    ▼                       ▼
┌────────────────┐  ┌───────────────────┐  ┌──────────────────────┐
│  INTEGRATION   │  │    DATA LAYER     │  │   SANDBOX LAYER      │
│    LAYER       │  │                   │  │                      │
│ ┌────────────┐ │  │   ┌───────────┐   │  │  ┌────────────────┐  │
│ │  GitHub    │ │  │   │  MongoDB  │   │  │  │ Docker         │  │
│ │  (Octokit) │ │  │   │          │   │  │  │ Containers     │  │
│ ├────────────┤ │  │   │ - users  │   │  │  │ (Exploit       │  │
│ │  OpenAI    │ │  │   │ - repos  │   │  │  │  Sandbox)      │  │
│ │  API       │ │  │   │ - vulns  │   │  │  └────────────────┘  │
│ ├────────────┤ │  │   │ - runs   │   │  │                      │
│ │  Semgrep   │ │  │   │ - patches│   │  └──────────────────────┘
│ │  CLI       │ │  │   │ - PRs    │   │
│ ├────────────┤ │  │   │ - logs   │   │
│ │  OWASP ZAP │ │  │   └───────────┘   │
│ └────────────┘ │  │                   │
└────────────────┘  └───────────────────┘
```

---

## 2. Architecture Layers

### 2.1 Presentation Layer

A vanilla HTML/CSS/JavaScript dashboard served as static files by Express. No frontend framework — keeps things simple, fast, and dependency-light.

**Responsibilities:**
- Display repository status, vulnerability reports, and agent execution logs
- Provide controls for manual scan triggers and settings management
- Show real-time agent activity (polling-based in v1, WebSocket upgrade later)
- Pull Request history and tracking

The dashboard communicates with the backend exclusively through REST API calls. There's no server-side rendering — it's a proper client-side app built with vanilla JS modules.

### 2.2 API Layer

Express.js application handling HTTP requests. Follows a standard Controller → Service → Repository pattern.

**Key endpoint groups (designed in detail in Phase 4):**
- `POST /api/webhooks/github` — Receive GitHub webhook events
- `GET/POST /api/repositories` — Manage monitored repositories
- `GET /api/vulnerabilities` — Query vulnerability reports
- `GET /api/agents/runs` — Agent execution history
- `GET /api/pull-requests` — PR tracking
- `POST /api/scans` — Manual scan triggers

**Middleware stack:**
1. `helmet` — Security headers
2. `cors` — Cross-origin config
3. `express.json()` — Body parsing
4. `morgan` / custom logger — Request logging
5. `authMiddleware` — JWT verification
6. `rateLimiter` — API rate limiting
7. `errorHandler` — Centralized error handling

### 2.3 Agent Orchestration Layer

The brain of the system. Manages the multi-agent pipeline through an event-driven architecture.

**Components:**
- **Event Bus** — Internal `EventEmitter` instance that routes messages between agents. Each event carries a `workflowId` for traceability.
- **Workflow State Machine** — Tracks each scan workflow through its lifecycle states: `PENDING → ANALYZING → TRIAGING → EXPLOITING → PATCHING → VALIDATING → CREATING_PR → COMPLETED / FAILED`
- **Agent Registry** — Maintains references to all registered agents and their health status.
- **Agent Runner** — Executes agents with timeout protection, error capturing, and retry logic.

### 2.4 Integration Layer

Wrappers around external services. Each integration module follows a consistent interface so we can swap implementations without touching agent code.

| Integration | Library | Usage |
|------------|---------|-------|
| GitHub | `@octokit/rest` | Repo cloning, branch creation, commits, PRs |
| OpenAI | `openai` | Vulnerability analysis, patch generation |
| Semgrep | CLI subprocess | Static analysis scanning |
| OWASP ZAP | REST API | Dynamic security testing |
| Docker | `dockerode` | Sandbox container management |

### 2.5 Data Layer

MongoDB with Mongoose ODM. Document-based storage fits naturally here because agent execution data is hierarchical and varies in shape between agents.

**Collections:**
- `users` — Dashboard authentication
- `repositories` — Monitored repos and their config
- `vulnerabilities` — Detected security issues
- `agent_runs` — Agent execution records
- `exploit_results` — Exploit verification outcomes
- `patches` — Generated code patches
- `pull_requests` — Created PR records
- `audit_logs` — System-wide audit trail

Detailed schemas designed in Phase 3.

### 2.6 Sandbox Layer

Docker-based isolated execution environment for the Exploit Agent. Each vulnerability verification spins up a fresh container with:
- Network isolation (no outbound access)
- Resource limits (CPU, memory, time)
- Read-only source code mount
- Predefined exploit template execution
- Automatic cleanup after execution

---

## 3. Multi-Agent System

### 3.1 Agent Lifecycle

Every agent follows the same lifecycle, enforced by the `BaseAgent` abstract class:

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│ initialize │ ──▶ │  execute   │ ──▶ │   report   │
│            │     │            │     │            │
│ Load config│     │ Run core   │     │ Persist    │
│ Validate   │     │ logic      │     │ results    │
│ deps       │     │            │     │ Emit event │
└────────────┘     └────────────┘     └────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
   LOG: init          LOG: progress      LOG: complete
   STATUS: ready      STATUS: running    STATUS: done/failed
```

### 3.2 BaseAgent Interface

```javascript
// Conceptual interface — actual implementation in Phase 6
class BaseAgent {
    constructor(name, config) {}

    async initialize(context) {}   // Setup, validate dependencies
    async execute(input) {}        // Core logic — override per agent
    async report(result) {}        // Persist results, emit events
    async teardown() {}            // Cleanup resources
}
```

### 3.3 Agent Communication

Agents never talk to each other directly. All communication routes through the Orchestrator via the Event Bus:

```
Analysis Agent                    Orchestrator                    Triage Agent
      │                                │                               │
      │  emit('analysis:complete',     │                               │
      │        vulnReport)             │                               │
      │ ─────────────────────────────▶ │                               │
      │                                │  Validate result              │
      │                                │  Update workflow state        │
      │                                │  emit('triage:start',         │
      │                                │        vulnReport)            │
      │                                │ ────────────────────────────▶ │
      │                                │                               │
```

This decoupling means an agent doesn't need to know what runs after it. It just reports results and the Orchestrator decides the next move.

### 3.4 Workflow State Machine

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
  PENDING ──▶ ANALYZING ──▶ TRIAGING ──▶ EXPLOITING ──▶ PATCHING │
                                                            │      │
                                                            ▼      │
                                        CREATING_PR ◀── VALIDATING│
                                            │                      │
                                            ▼                      │
                                        COMPLETED                  │
                                                                   │
                    Any state can transition to ──▶ FAILED ◀───────┘
```

Each workflow gets a unique `workflowId` (UUID). All agent executions, vulnerability records, and patches link to this ID for traceability.

---

## 4. Communication Patterns

### 4.1 Internal Communication

**v1 approach: Node.js EventEmitter (single process)**

All agents live in the same Node.js process. The Event Bus is a singleton `EventEmitter`. Simple, zero infrastructure overhead, perfectly fine for a v1 handling one workflow at a time.

**Future upgrade path: Redis Pub/Sub or RabbitMQ**

Agent interfaces are designed so swapping the Event Bus implementation requires changes only in the `events/` module — not in any agent code. When we need to scale agents across processes, we plug in a distributed broker.

### 4.2 External Communication

| Direction | Protocol | Details |
|-----------|----------|---------|
| GitHub → Phantom Patch | HTTP Webhook | Push/PR events trigger workflow |
| Phantom Patch → GitHub | REST API | Clone, branch, commit, PR creation |
| Phantom Patch → OpenAI | REST API | Vulnerability analysis, patch gen |
| Phantom Patch → Semgrep | CLI subprocess | Static code analysis |
| Phantom Patch → Docker | Docker SDK | Container lifecycle management |
| Dashboard → Backend | REST API | Data queries, manual triggers |

---

## 5. Security Architecture

### 5.1 Authentication & Authorization

- **Dashboard**: JWT-based auth. Tokens issued on login, verified on every API request.
- **Webhooks**: GitHub webhook signature verification using HMAC-SHA256.
- **API Keys**: All external service keys in environment variables, never in code.

### 5.2 Exploit Sandboxing

The Exploit Agent is the most security-sensitive component. Safeguards:

1. **Docker isolation** — Each exploit in a fresh container with no network access
2. **Template-only** — Only predefined exploit scripts run, no arbitrary code
3. **Resource limits** — CPU (0.5 cores), Memory (256MB), Time (30s timeout)
4. **Read-only mounts** — Source code mounted read-only
5. **No persistence** — Containers destroyed after each test
6. **Audit logging** — Every exploit attempt logged with full context

### 5.3 Secret Management

```
.env (local development)
├── MONGODB_URI
├── GITHUB_TOKEN
├── GITHUB_WEBHOOK_SECRET
├── OPENAI_API_KEY
├── JWT_SECRET
├── SEMGREP_APP_TOKEN (optional)
└── ZAP_API_KEY (optional)
```

Production deployment will use Docker secrets or a vault service. The config module abstracts the source so application code doesn't care where secrets come from.

### 5.4 Audit Trail

Every significant action generates an audit log entry:
- Agent execution start/complete/fail
- Vulnerability detection events
- Exploit attempts and results
- Patch generation
- PR creation
- User dashboard actions

---

## 6. Deployment Architecture

### 6.1 Local Development

```
docker-compose.yml
├── phantom-api        (Node.js app + static dashboard)
│   ├── Port 3000      (API + Dashboard)
│   └── Volume mount   (src/ for hot reload)
├── mongodb            (MongoDB 6.x)
│   ├── Port 27017
│   └── Volume         (persistent data)
└── (optional) mongo-express
    └── Port 8081      (DB admin UI)
```

### 6.2 Production (Future)

```
┌─────────────────────────────────────────────┐
│              Load Balancer (nginx)           │
└─────────────────┬───────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│ API     │ │ API     │ │ API     │
│ Node 1  │ │ Node 2  │ │ Node 3  │
└────┬────┘ └────┬────┘ └────┬────┘
     │            │            │
     └────────────┼────────────┘
                  │
          ┌───────┴────────┐
          │   MongoDB      │
          │   Replica Set  │
          └────────────────┘
```

---

## 7. Scalability Considerations

Designed in but not implemented in v1:

1. **Horizontal agent scaling** — Agent interfaces support distributed execution via message broker swap
2. **Workflow queuing** — Multiple scan workflows can queue and process sequentially (parallel later)
3. **Database indexing** — Indexes planned for all query-heavy fields
4. **Caching layer** — Redis can be added for frequently accessed data
5. **WebSocket upgrade** — Dashboard can move from polling to real-time updates

---

## 8. Error Handling Strategy

### 8.1 Agent-Level

- Each agent wraps `execute()` in try-catch
- Failed agents report error details through `report()`
- Configurable retry policy (default: 2 retries with exponential backoff)
- Timeout protection (configurable per agent, default: 5 minutes)

### 8.2 Workflow-Level

- Orchestrator catches agent failures and decides: retry, skip, or abort
- Critical agent failure (Analysis, Exploit) → abort workflow
- Non-critical failure (Triage confidence low) → proceed with manual review flag
- All failures logged to `audit_logs` collection

### 8.3 System-Level

- Express global error handler catches unhandled exceptions
- Graceful shutdown on SIGTERM/SIGINT (drain active workflows, close DB connections)
- Health check endpoint (`GET /api/health`) for monitoring
- Winston logger with console + file output and rotation
