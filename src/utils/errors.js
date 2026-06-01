/**
 * Custom Error Classes
 *
 * Structured errors for consistent error handling across the app.
 *
 * Implementation: Phase 6
 */

class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401);
    }
}

class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
    }
}

class AgentExecutionError extends AppError {
    constructor(agentName, message) {
        super(`Agent [${agentName}]: ${message}`, 500);
        this.agentName = agentName;
    }
}

class ExternalServiceError extends AppError {
    constructor(service, message) {
        super(`External service [${service}]: ${message}`, 502);
        this.service = service;
    }
}

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    NotFoundError,
    AgentExecutionError,
    ExternalServiceError
};
