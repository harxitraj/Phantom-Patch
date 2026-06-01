const mongoose = require('mongoose');

const repositorySchema = new mongoose.Schema(
    {
        owner: {
            type: String,
            required: [true, 'Repository owner is required'],
            trim: true
        },
        name: {
            type: String,
            required: [true, 'Repository name is required'],
            trim: true
        },
        fullName: {
            type: String,
            required: [true, 'Repository full name (owner/name) is required'],
            unique: true,
            trim: true,
            index: true
        },
        cloneUrl: {
            type: String,
            required: [true, 'Repository clone URL is required'],
            trim: true
        },
        defaultBranch: {
            type: String,
            default: 'main',
            trim: true
        },
        isActive: {
            type: Boolean,
            default: true
        },
        lastScanAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

// Compound index on owner and name for quick lookup
repositorySchema.index({ owner: 1, name: 1 });

module.exports = mongoose.model('Repository', repositorySchema);
