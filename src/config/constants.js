/**
 * Application Constants
 *
 * Centralized constants used across the application.
 * Avoids magic strings scattered through the codebase.
 *
 * Implementation: Phase 6
 */

const WORKFLOW_STATUS = {
    PENDING: 'pending',
    ANALYZING: 'analyzing',
    TRIAGING: 'triaging',
    EXPLOITING: 'exploiting',
    PATCHING: 'patching',
    VALIDATING: 'validating',
    CREATING_PR: 'creating_pr',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

const AGENT_STATUS = {
    IDLE: 'idle',
    INITIALIZING: 'initializing',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

const VULNERABILITY_TYPE = {
    SQL_INJECTION: 'SQL_INJECTION',
    XSS: 'XSS',
    HARDCODED_SECRET: 'HARDCODED_SECRET',
    COMMAND_INJECTION: 'COMMAND_INJECTION'
};

const SEVERITY = {
    CRITICAL: 'CRITICAL',
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW',
    INFO: 'INFO'
};

const CONFIDENCE = {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW'
};

const TRIGGER_TYPE = {
    PUSH: 'push',
    PULL_REQUEST: 'pull_request',
    MANUAL: 'manual'
};

module.exports = {
    WORKFLOW_STATUS,
    AGENT_STATUS,
    VULNERABILITY_TYPE,
    SEVERITY,
    CONFIDENCE,
    TRIGGER_TYPE
};
