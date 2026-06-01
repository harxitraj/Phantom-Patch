const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        logId: {
            type: String,
            required: [true, 'Log ID (UUID) is required'],
            unique: true,
            trim: true,
            index: true
        },
        workflowId: {
            type: String,
            trim: true,
            index: true
        },
        action: {
            type: String,
            required: [true, 'Audit action is required'],
            trim: true,
            index: true
        },
        actor: {
            type: String,
            required: [true, 'Actor is required'],
            trim: true,
            index: true
        },
        details: {
            type: mongoose.Schema.Types.Mixed
        },
        severity: {
            type: String,
            enum: ['info', 'warn', 'error', 'critical'],
            default: 'info',
            index: true
        }
    },
    {
        timestamps: { createdAt: 'timestamp', updatedAt: false }
    }
);

// General compound index for searching audit logs by action type and time
auditLogSchema.index({ action: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
