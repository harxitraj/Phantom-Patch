# Folder Structure — Phantom Patch

> Planned directory layout for the complete project. Directories and files will be created as we progress through each phase.

---

## Complete Project Structure

```
phantom-patch/
│
├── .gitignore
├── .env.example                        # Template for environment variables
├── LICENSE
├── README.md
├── package.json
│
├── docs/                               # All project documentation
│   └── architecture/
│       ├── ARCHITECTURE.md             # System architecture overview
│       ├── AGENT_DESIGN.md             # Agent specifications & contracts
│       ├── DATA_FLOW.md                # End-to-end data flow
│       └── FOLDER_STRUCTURE.md         # This file
│
├── src/                                # All backend source code
│   │
│   ├── server/                         # Application entry point
│   │   ├── app.js                      # Express app setup (middleware, routes)
│   │   └── index.js                    # Server startup, DB connection, graceful shutdown
│   │
│   ├── config/                         # Configuration management
│   │   ├── index.js                    # Central config loader (reads .env)
│   │   ├── database.js                 # MongoDB connection config
│   │   └── constants.js                # App-wide constants (statuses, limits, defaults)
│   │
│   ├── api/                            # REST API layer
│   │   ├── routes/                     # Route definitions (URL → controller mapping)
│   │   │   ├── index.js               # Route aggregator
│   │   │   ├── auth.routes.js
│   │   │   ├── repository.routes.js
│   │   │   ├── vulnerability.routes.js
│   │   │   ├── scan.routes.js
│   │   │   ├── agent.routes.js
│   │   │   ├── pullRequest.routes.js
│   │   │   └── webhook.routes.js
│   │   │
│   │   ├── controllers/               # Request handlers (parse input → call service → send response)
│   │   │   ├── auth.controller.js
│   │   │   ├── repository.controller.js
│   │   │   ├── vulnerability.controller.js
│   │   │   ├── scan.controller.js
│   │   │   ├── agent.controller.js
│   │   │   ├── pullRequest.controller.js
│   │   │   └── webhook.controller.js
│   │   │
│   │   ├── middlewares/                # Express middleware
│   │   │   ├── auth.middleware.js      # JWT verification
│   │   │   ├── rateLimiter.middleware.js
│   │   │   ├── validator.middleware.js # Request validation wrapper
│   │   │   ├── webhook.middleware.js   # GitHub signature verification
│   │   │   └── errorHandler.middleware.js
│   │   │
│   │   └── validators/                # Input validation schemas (Joi or similar)
│   │       ├── auth.validator.js
│   │       ├── repository.validator.js
│   │       └── scan.validator.js
│   │
│   ├── agents/                         # Multi-agent system
│   │   ├── base/
│   │   │   ├── BaseAgent.js            # Abstract base class all agents extend
│   │   │   └── AgentRunner.js          # Execution wrapper (timeout, retry, error handling)
│   │   │
│   │   ├── orchestrator/
│   │   │   ├── OrchestratorAgent.js    # Central workflow coordinator
│   │   │   └── workflowStateMachine.js # State machine logic
│   │   │
│   │   ├── analysis/
│   │   │   ├── AnalysisAgent.js        # Vulnerability detection
│   │   │   ├── scanners/
│   │   │   │   ├── semgrepScanner.js   # Semgrep integration
│   │   │   │   └── llmScanner.js       # LLM-based code review
│   │   │   └── resultMerger.js         # Deduplication logic
│   │   │
│   │   ├── triage/
│   │   │   ├── TriageAgent.js          # False positive filtering
│   │   │   └── scoringEngine.js        # Priority scoring logic
│   │   │
│   │   ├── exploit/
│   │   │   ├── ExploitAgent.js         # Exploit verification
│   │   │   ├── sandboxManager.js       # Docker container lifecycle
│   │   │   └── templateSelector.js     # Match vuln type → exploit template
│   │   │
│   │   ├── patch/
│   │   │   ├── PatchAgent.js           # Patch generation
│   │   │   ├── promptBuilder.js        # Build LLM prompt with context
│   │   │   └── diffGenerator.js        # Generate unified diff from patch
│   │   │
│   │   ├── validation/
│   │   │   ├── ValidationAgent.js      # Patch testing
│   │   │   ├── testRunner.js           # Execute project test suite
│   │   │   └── securityRescan.js       # Re-scan patched code
│   │   │
│   │   └── gitops/
│   │       ├── GitOpsAgent.js          # PR creation
│   │       ├── branchManager.js        # Branch operations
│   │       └── prBuilder.js            # Build PR title, body, labels
│   │
│   ├── services/                       # Business logic layer
│   │   ├── auth.service.js             # User authentication & JWT
│   │   ├── repository.service.js       # Repository CRUD & config
│   │   ├── vulnerability.service.js    # Vulnerability queries & aggregation
│   │   ├── scan.service.js             # Scan triggering & management
│   │   ├── agent.service.js            # Agent run queries
│   │   ├── pullRequest.service.js      # PR tracking
│   │   └── audit.service.js            # Audit log management
│   │
│   ├── models/                         # Mongoose schemas & models
│   │   ├── User.js
│   │   ├── Repository.js
│   │   ├── Vulnerability.js
│   │   ├── AgentRun.js
│   │   ├── ExploitResult.js
│   │   ├── Patch.js
│   │   ├── PullRequest.js
│   │   └── AuditLog.js
│   │
│   ├── integrations/                   # External service wrappers
│   │   ├── github/
│   │   │   ├── githubClient.js         # Octokit setup & auth
│   │   │   ├── repoOperations.js       # Clone, branch, commit, push
│   │   │   └── webhookHandler.js       # Webhook payload parsing
│   │   │
│   │   ├── openai/
│   │   │   ├── openaiClient.js         # OpenAI SDK setup
│   │   │   └── promptTemplates.js      # Reusable prompt templates
│   │   │
│   │   ├── semgrep/
│   │   │   ├── semgrepRunner.js        # CLI execution wrapper
│   │   │   └── ruleConfig.js           # Ruleset configuration
│   │   │
│   │   └── docker/
│   │       ├── dockerClient.js         # dockerode setup
│   │       └── containerManager.js     # Container lifecycle operations
│   │
│   ├── events/                         # Event bus system
│   │   ├── eventBus.js                 # Singleton EventEmitter instance
│   │   ├── eventTypes.js               # Event name constants
│   │   └── eventHandlers.js            # Event → Agent mapping
│   │
│   ├── utils/                          # Shared utilities
│   │   ├── logger.js                   # Winston logger setup
│   │   ├── errors.js                   # Custom error classes
│   │   ├── helpers.js                  # General utility functions
│   │   └── crypto.js                   # Hashing, token generation
│   │
│   └── workers/                        # Background job processing (future)
│       └── scanWorker.js               # Async scan job processor
│
├── public/                             # Frontend dashboard (static files)
│   ├── index.html                      # Main entry point / shell
│   │
│   ├── pages/                          # Page-level HTML files
│   │   ├── login.html
│   │   ├── dashboard.html
│   │   ├── repositories.html
│   │   ├── vulnerabilities.html
│   │   ├── agent-logs.html
│   │   ├── pull-requests.html
│   │   └── settings.html
│   │
│   └── assets/
│       ├── css/
│       │   ├── main.css                # Global styles, design tokens
│       │   ├── components.css          # Reusable component styles
│       │   └── pages/                  # Page-specific styles
│       │       ├── dashboard.css
│       │       ├── vulnerabilities.css
│       │       └── agent-logs.css
│       │
│       ├── js/
│       │   ├── app.js                  # Main JS entry, router
│       │   ├── api.js                  # API client (fetch wrapper)
│       │   ├── auth.js                 # Login/logout, token management
│       │   ├── router.js               # Client-side routing
│       │   ├── components/             # Reusable UI components
│       │   │   ├── navbar.js
│       │   │   ├── sidebar.js
│       │   │   ├── statsCard.js
│       │   │   ├── dataTable.js
│       │   │   └── modal.js
│       │   └── pages/                  # Page-level logic
│       │       ├── dashboard.js
│       │       ├── repositories.js
│       │       ├── vulnerabilities.js
│       │       ├── agentLogs.js
│       │       ├── pullRequests.js
│       │       └── settings.js
│       │
│       └── images/
│           ├── logo.svg
│           └── icons/
│
├── tests/                              # Test suites
│   ├── unit/
│   │   ├── agents/
│   │   ├── services/
│   │   └── utils/
│   │
│   ├── integration/
│   │   ├── api/
│   │   └── agents/
│   │
│   └── e2e/
│       └── workflows/
│
├── docker/                             # Docker configuration
│   ├── Dockerfile                      # Main application image
│   ├── Dockerfile.sandbox              # Exploit sandbox image
│   └── docker-compose.yml              # Local development stack
│
├── scripts/                            # Development & utility scripts
│   ├── seed.js                         # Database seeding
│   ├── setup.js                        # First-time setup wizard
│   └── cleanup.js                      # Temp file cleanup
│
├── exploit-templates/                  # Predefined exploit scripts
│   ├── sql-injection/
│   │   ├── auth-bypass.js
│   │   └── data-extraction.js
│   ├── xss/
│   │   ├── reflected-xss.js
│   │   └── stored-xss.js
│   ├── cmd-injection/
│   │   └── basic-exec.js
│   └── secrets/
│       └── exposure-check.js
│
└── .github/                            # GitHub-specific config
    ├── workflows/
    │   ├── ci.yml                      # Lint + test on push
    │   └── release.yml                 # Release workflow
    ├── PULL_REQUEST_TEMPLATE.md
    └── ISSUE_TEMPLATE/
        ├── bug_report.md
        └── feature_request.md
```

---

## Directory Purposes (Quick Reference)

| Directory | Responsibility | Created In |
|-----------|---------------|------------|
| `docs/architecture/` | Design documentation | Phase 1 |
| `src/server/` | App bootstrap & startup | Phase 6 |
| `src/config/` | Configuration loading | Phase 6 |
| `src/api/` | REST endpoints | Phase 6 |
| `src/agents/` | Multi-agent system | Phase 6 |
| `src/services/` | Business logic | Phase 6 |
| `src/models/` | Database schemas | Phase 3 |
| `src/integrations/` | External services | Phase 8-10 |
| `src/events/` | Event bus | Phase 5-6 |
| `src/utils/` | Shared helpers | Phase 6 |
| `public/` | Frontend dashboard | Phase 7 |
| `tests/` | Test suites | Phase 12 |
| `docker/` | Container config | Phase 11 |
| `exploit-templates/` | Exploit scripts | Phase 9 |

---

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Directories | camelCase | `agentLogs/`, `pullRequest/` |
| Route files | kebab-style with suffix | `repository.routes.js` |
| Controller files | kebab-style with suffix | `repository.controller.js` |
| Model files | PascalCase | `Repository.js`, `AgentRun.js` |
| Agent files | PascalCase | `AnalysisAgent.js`, `PatchAgent.js` |
| Utility files | camelCase | `logger.js`, `helpers.js` |
| CSS files | kebab-case | `main.css`, `components.css` |
| Frontend JS | camelCase | `app.js`, `dataTable.js` |

---

## Key Design Decisions

### Why flat services instead of nested by domain?

We keep `services/` flat (not grouped by feature) because at this project size, having 7-8 service files in one directory is perfectly navigable. If the project grows significantly, we can restructure into domain-grouped modules.

### Why separate `integrations/` from `services/`?

Integration modules are wrappers around **external** APIs (GitHub, OpenAI, Docker). Services contain **our** business logic. This separation means if we swap OpenAI for Claude, we change one file in `integrations/openai/` and nothing else.

### Why `public/` at root instead of a separate frontend repo?

For v1, serving static files from Express keeps the development loop simple. One `npm run dev` starts everything. When the frontend gets complex enough to warrant its own build pipeline, we can extract it.

### Why `exploit-templates/` at root?

These are not application code — they're data files (predefined scripts) that the Exploit Agent loads at runtime. Keeping them at root makes them discoverable and easy to add new templates to without touching the `src/` tree.
