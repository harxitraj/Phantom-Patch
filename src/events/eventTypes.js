/**
 * Event Type Constants
 *
 * All event names used in the system. Centralizing them here
 * prevents typo-based bugs and makes the event flow discoverable.
 *
 * Implementation: Phase 5
 */

const EVENTS = {
    // Workflow lifecycle
    WORKFLOW_START: 'workflow:start',
    WORKFLOW_COMPLETE: 'workflow:complete',
    WORKFLOW_FAILED: 'workflow:failed',

    // Analysis Agent
    ANALYSIS_START: 'analysis:start',
    ANALYSIS_PROGRESS: 'analysis:progress',
    ANALYSIS_COMPLETE: 'analysis:complete',
    ANALYSIS_FAILED: 'analysis:failed',

    // Triage Agent
    TRIAGE_START: 'triage:start',
    TRIAGE_COMPLETE: 'triage:complete',
    TRIAGE_FAILED: 'triage:failed',

    // Exploit Agent
    EXPLOIT_START: 'exploit:start',
    EXPLOIT_COMPLETE: 'exploit:complete',
    EXPLOIT_FAILED: 'exploit:failed',

    // Patch Agent
    PATCH_START: 'patch:start',
    PATCH_COMPLETE: 'patch:complete',
    PATCH_FAILED: 'patch:failed',

    // Validation Agent
    VALIDATION_START: 'validation:start',
    VALIDATION_COMPLETE: 'validation:complete',
    VALIDATION_FAILED: 'validation:failed',

    // GitOps Agent
    GITOPS_START: 'gitops:start',
    GITOPS_COMPLETE: 'gitops:complete',
    GITOPS_FAILED: 'gitops:failed',

    // Dashboard updates
    DASHBOARD_UPDATE: 'dashboard:update'
};

module.exports = EVENTS;
