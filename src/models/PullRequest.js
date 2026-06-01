const mongoose = require('mongoose');

const pullRequestSchema = new mongoose.Schema(
    {
        prId: {
            type: String,
            required: [true, 'PR ID (UUID) is required'],
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
        number: {
            type: Number,
            required: [true, 'Pull Request number is required'],
            index: true
        },
        url: {
            type: String,
            required: [true, 'Pull Request URL is required'],
            trim: true
        },
        title: {
            type: String,
            required: [true, 'Pull Request title is required'],
            trim: true
        },
        branch: {
            type: String,
            required: [true, 'Pull Request branch is required'],
            trim: true
        },
        status: {
            type: String,
            enum: ['open', 'merged', 'closed'],
            default: 'open',
            index: true
        },
        labels: [
            {
                type: String,
                trim: true
            }
        ],
        filesChanged: {
            type: Number
        },
        additions: {
            type: Number
        },
        deletions: {
            type: Number
        },
        commits: [
            {
                sha: {
                    type: String,
                    trim: true
                },
                message: {
                    type: String,
                    trim: true
                }
            }
        ]
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('PullRequest', pullRequestSchema);
