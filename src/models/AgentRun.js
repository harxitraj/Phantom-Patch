const mongoose = require('mongoose');

const agentRunSchema = new mongoose.Schema(
    {
        runId: {
            type: String,
            required: [true, 'Run ID (UUID) is required'],
            unique: true,
            trim: true,
            index: true
        },
        workflowId: {
            type: String,
            required: [true, 'Workflow ID (UUID) is required'],
            trim: true,
            index: true
        },
        agentName: {
            type: String,
            required: [true, 'Agent name is required'],
            trim: true
        },
        status: {
            type: String,
            enum: ['idle', 'initializing', 'running', 'completed', 'failed'],
            required: [true, 'Agent run status is required']
        },
        input: {
            type: mongoose.Schema.Types.Mixed
        },
        output: {
            type: mongoose.Schema.Types.Mixed
        },
        error: {
            message: {
                type: String,
                trim: true
            },
            stack: {
                type: String,
                trim: true
            }
        },
        durationMs: {
            type: Number
        },
        startedAt: {
            type: Date,
            required: [true, 'Start timestamp is required']
        },
        completedAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

// Compound index to query runs within a workflow in execution order
agentRunSchema.index({ workflowId: 1, startedAt: 1 });

module.exports = mongoose.model('AgentRun', agentRunSchema);
