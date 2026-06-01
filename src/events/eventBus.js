/**
 * Event Bus — Agent Communication Layer
 *
 * Singleton EventEmitter that routes messages between agents.
 * All inter-agent communication goes through this bus.
 *
 * Designed for easy swap to Redis Pub/Sub or RabbitMQ
 * when distributed execution is needed.
 *
 * Implementation: Phase 5-6
 */

// TODO: Import EventEmitter from 'events'
// TODO: Import logger

// const eventBus = new EventEmitter();

// Increase max listeners since we have 7+ agents
// eventBus.setMaxListeners(20);

// TODO: Add debug logging wrapper
// - Log every emitted event (name + workflowId)
// - Useful for debugging pipeline flow

// module.exports = eventBus;
