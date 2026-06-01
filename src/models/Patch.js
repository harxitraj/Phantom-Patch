const mongoose = require('mongoose');

const patchSchema = new mongoose.Schema(
    {
        patchId: {
            type: String,
            required: [true, 'Patch ID (UUID) is required'],
            unique: true,
            trim: true,
            index: true
        },
        vulnerabilityId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vulnerability',
            required: [true, 'Vulnerability ID is required'],
            index: true
        },
        workflowId: {
            type: String,
            required: [true, 'Workflow ID (UUID) is required'],
            trim: true,
            index: true
        },
        filePath: {
            type: String,
            required: [true, 'File path is required'],
            trim: true
        },
        originalCode: {
            type: String,
            required: [true, 'Original code is required']
        },
        patchedCode: {
            type: String,
            required: [true, 'Patched code is required']
        },
        diffContent: {
            type: String,
            required: [true, 'Diff content is required']
        },
        explanation: {
            type: String,
            trim: true
        },
        confidence: {
            type: Number,
            min: 0,
            max: 1
        },
        validationStatus: {
            type: String,
            enum: ['pending', 'passed', 'failed'],
            default: 'pending',
            index: true
        },
        validationReport: {
            validationDurationMs: {
                type: Number
            },
            syntaxCheck: {
                type: String,
                trim: true
            },
            existingTests: {
                ran: {
                    type: Boolean,
                    default: false
                },
                passed: {
                    type: Number,
                    default: 0
                },
                failed: {
                    type: Number,
                    default: 0
                },
                total: {
                    type: Number,
                    default: 0
                },
                status: {
                    type: String,
                    trim: true
                }
            },
            securityRescan: {
                ran: {
                    type: Boolean,
                    default: false
                },
                originalVulnStillPresent: {
                    type: Boolean,
                    default: true
                },
                newVulnsIntroduced: {
                    type: Number,
                    default: 0
                },
                status: {
                    type: String,
                    trim: true
                }
            }
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Patch', patchSchema);
