/**
 * BaseAgent — Abstract Base Class
 *
 * All agents (Analysis, Triage, Exploit, Patch, Validation, GitOps)
 * extend this class. Enforces a consistent lifecycle:
 *
 *   initialize() → execute() → report() → teardown()
 *
 * Implementation: Phase 6
 */

// TODO: Import logger
// TODO: Import AGENT_STATUS from constants

// class BaseAgent {
//     constructor(name, config = {}) {
//         this.name = name;
//         this.config = config;
//         this.status = AGENT_STATUS.IDLE;
//         this.logger = null; // child logger with agent context
//     }
//
//     async initialize(context) {
//         // Override in subclass if needed
//         // Validate dependencies, load config
//     }
//
//     async execute(input) {
//         // MUST be overridden by each agent
//         throw new Error(`${this.name}: execute() not implemented`);
//     }
//
//     async report(result) {
//         // Persist result to database
//         // Emit completion event via event bus
//     }
//
//     async teardown() {
//         // Cleanup resources (temp files, containers, etc.)
//     }
// }

// module.exports = BaseAgent;
