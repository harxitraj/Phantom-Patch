/**
 * Schema Verification Script
 *
 * Verifies that all 8 Mongoose models in src/models/ load properly,
 * validate fields correctly, and execute hooks (like password hashing on User)
 * as designed, without needing an active MongoDB connection.
 */

const mongoose = require('mongoose');
const User = require('../src/models/User');
const Repository = require('../src/models/Repository');
const Vulnerability = require('../src/models/Vulnerability');
const AgentRun = require('../src/models/AgentRun');
const ExploitResult = require('../src/models/ExploitResult');
const Patch = require('../src/models/Patch');
const PullRequest = require('../src/models/PullRequest');
const AuditLog = require('../src/models/AuditLog');

// Generate simple mock UUID
const mockUuid = () => '11111111-2222-3333-4444-555555555555';

async function testUserSchema() {
    console.log('\n--- Testing User Schema ---');
    
    const user = new User({
        username: 'security-guardian',
        email: 'guardian@phantom.security',
        password: 'securePassword123!',
        role: 'admin'
    });

    // Verify properties before saving (pre-save hook)
    console.log('Username:', user.username);
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('Password (plain before pre-save):', user.password);

    // Call pre-save hooks manually using Mongoose's validate
    await user.validate();
    
    // Simulate save by running the save middleware hooks
    // Mongoose allows executing hooks manually by calling save() inside a transaction
    // or we can test the pre('save') hook directly via Mongoose internals.
    // For verification, we can trigger the hook by calling the hook function or just using a mock mongo connection or stubbing.
    // Let's run a quick mock test using standard mongoose features:
    // To execute save hooks without a database, we can check if it hashes when we trigger 'save' middleware manually.
    // Let's trigger Mongoose's internal hook runner:
    // Trigger pre-save hooks manually
    const preSaveHooks = user.schema.s.hooks._pres.get('save') || [];
    for (const hook of preSaveHooks) {
        await hook.fn.call(user);
    }

    console.log('Password (hashed after mock save hook):', user.password);
    if (user.password === 'securePassword123!') {
        throw new Error('Password was not hashed by pre-save hook!');
    }
    console.log('✓ Password hashing pre-save hook passed.');

    const isMatch = await user.comparePassword('securePassword123!');
    console.log('Password match test ("securePassword123!"):', isMatch);
    if (!isMatch) {
        throw new Error('comparePassword failed for correct password!');
    }
    
    const isFalseMatch = await user.comparePassword('wrongPassword');
    console.log('Password mismatch test ("wrongPassword"):', isFalseMatch);
    if (isFalseMatch) {
        throw new Error('comparePassword approved an incorrect password!');
    }
    console.log('✓ password.comparePassword() instance method passed.');

    // Check JSON transform
    const json = user.toJSON();
    console.log('toJSON serialization (password deleted?):', !json.password);
    if (json.password) {
        throw new Error('Password was not excluded in toJSON transform!');
    }
    console.log('✓ toJSON transform exclusions passed.');
}

async function testRepositorySchema() {
    console.log('\n--- Testing Repository Schema ---');
    const repo = new Repository({
        owner: 'google-deepmind',
        name: 'phantom-patch',
        fullName: 'google-deepmind/phantom-patch',
        cloneUrl: 'https://github.com/google-deepmind/phantom-patch.git',
        defaultBranch: 'main'
    });

    await repo.validate();
    console.log('✓ Repository schema validation passed.');
    console.log('FullName:', repo.fullName);
    console.log('Default Branch:', repo.defaultBranch);
    console.log('isActive (Default):', repo.isActive);
}

async function testVulnerabilitySchema() {
    console.log('\n--- Testing Vulnerability Schema ---');
    const mockRepoId = new mongoose.Types.ObjectId();
    const vuln = new Vulnerability({
        vulnId: mockUuid(),
        workflowId: mockUuid(),
        repositoryId: mockRepoId,
        type: 'SQL_INJECTION',
        severity: 'CRITICAL',
        confidence: 'HIGH',
        filePath: 'src/controllers/userController.js',
        lineNumber: 45,
        codeSnippet: 'const query = `SELECT * FROM users WHERE id = ${req.params.id}`',
        description: 'User input direct interpolation',
        cweId: 'CWE-89',
        detectedBy: 'semgrep',
        rule: 'javascript.express.sql-injection',
        triage: {
            score: 9.2,
            reason: 'User input is reachable and unescaped.',
            exploitLikelihood: 'HIGH',
            businessImpact: 'Full DB read bypass'
        }
    });

    await vuln.validate();
    console.log('✓ Vulnerability schema validation passed.');
    console.log('Vuln ID:', vuln.vulnId);
    console.log('Status (Default):', vuln.status);
    console.log('Triage Score:', vuln.triage.score);
    console.log('Triage Status (Default):', vuln.triage.status);
}

async function testAgentRunSchema() {
    console.log('\n--- Testing AgentRun Schema ---');
    const run = new AgentRun({
        runId: mockUuid(),
        workflowId: mockUuid(),
        agentName: 'AnalysisAgent',
        status: 'running',
        input: { scanPath: '/tmp/repo' },
        startedAt: new Date()
    });

    await run.validate();
    console.log('✓ AgentRun schema validation passed.');
    console.log('Agent Name:', run.agentName);
    console.log('Status:', run.status);
}

async function testExploitResultSchema() {
    console.log('\n--- Testing ExploitResult Schema ---');
    const mockVulnId = new mongoose.Types.ObjectId();
    const exploit = new ExploitResult({
        exploitId: mockUuid(),
        vulnerabilityId: mockVulnId,
        workflowId: mockUuid(),
        verified: true,
        exploitDurationMs: 4500,
        payload: "' OR 1=1; --",
        evidence: {
            statusCode: 200,
            responseContains: 'admin@company.com',
            expectedBehavior: 'Should return unauthorized',
            actualBehavior: 'Returned all records'
        },
        riskScore: 9.5,
        exploitTemplate: 'sql-injection/auth-bypass.js',
        sandboxInfo: {
            containerId: 'container-12345',
            imageUsed: 'phantom-sandbox:latest',
            exitCode: 0,
            cleaned: true
        }
    });

    await exploit.validate();
    console.log('✓ ExploitResult schema validation passed.');
    console.log('Verified:', exploit.verified);
    console.log('Evidence Response:', exploit.evidence.responseContains);
    console.log('Cleaned Sandbox:', exploit.sandboxInfo.cleaned);
}

async function testPatchSchema() {
    console.log('\n--- Testing Patch Schema ---');
    const mockVulnId = new mongoose.Types.ObjectId();
    const patch = new Patch({
        patchId: mockUuid(),
        vulnerabilityId: mockVulnId,
        workflowId: mockUuid(),
        filePath: 'src/controllers/userController.js',
        originalCode: 'const query = `SELECT * FROM users WHERE id = ${req.params.id}`;',
        patchedCode: 'const query = "SELECT * FROM users WHERE id = $1";',
        diffContent: '--- a/src/controllers/userController.js\n+++ b/src/controllers/userController.js...',
        explanation: 'Parameterize SQL queries.',
        confidence: 0.95,
        validationReport: {
            validationDurationMs: 3400,
            syntaxCheck: 'PASS',
            existingTests: {
                ran: true,
                passed: 10,
                failed: 0,
                total: 10,
                status: 'PASS'
            },
            securityRescan: {
                ran: true,
                originalVulnStillPresent: false,
                newVulnsIntroduced: 0,
                status: 'PASS'
            }
        }
    });

    await patch.validate();
    console.log('✓ Patch schema validation passed.');
    console.log('Validation Status (Default):', patch.validationStatus);
    console.log('Patch Confidence:', patch.confidence);
    console.log('Security Rescan Status:', patch.validationReport.securityRescan.status);
}

async function testPullRequestSchema() {
    console.log('\n--- Testing PullRequest Schema ---');
    const pr = new PullRequest({
        prId: mockUuid(),
        workflowId: mockUuid(),
        number: 14,
        url: 'https://github.com/google-deepmind/phantom-patch/pull/14',
        title: 'fix(security): parameterize raw SQL queries',
        branch: 'phantom-patch/fix-sql-injection',
        labels: ['security', 'automated-fix'],
        filesChanged: 1,
        additions: 1,
        deletions: 1,
        commits: [
            {
                sha: 'a1b2c3d4e5f6',
                message: 'fix: parameterize queries'
            }
        ]
    });

    await pr.validate();
    console.log('✓ PullRequest schema validation passed.');
    console.log('PR Title:', pr.title);
    console.log('PR Number:', pr.number);
    console.log('Status (Default):', pr.status);
}

async function testAuditLogSchema() {
    console.log('\n--- Testing AuditLog Schema ---');
    const audit = new AuditLog({
        logId: mockUuid(),
        workflowId: mockUuid(),
        action: 'AGENT_COMPLETED',
        actor: 'AnalysisAgent',
        severity: 'info',
        details: { findingsCount: 3 }
    });

    await audit.validate();
    console.log('✓ AuditLog schema validation passed.');
    console.log('Log Action:', audit.action);
    console.log('Severity:', audit.severity);
}

async function runAllTests() {
    try {
        console.log('Starting Phantom Patch Mongoose Schema Verification...');
        await testUserSchema();
        await testRepositorySchema();
        await testVulnerabilitySchema();
        await testAgentRunSchema();
        await testExploitResultSchema();
        await testPatchSchema();
        await testPullRequestSchema();
        await testAuditLogSchema();
        
        console.log('\n======================================');
        console.log('🎉 ALL 8 MONGOOSE SCHEMAS ARE VERIFIED VALID!');
        console.log('======================================');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Verification Failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

runAllTests();
