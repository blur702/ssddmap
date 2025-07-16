# CI/CD Pipeline for SSDD Mapping Application

## Overview

This repository includes a comprehensive CI/CD pipeline using GitHub Actions to ensure code quality, run automated tests, and deploy the application safely.

## Workflows

### 1. CI Pipeline (`ci.yml`)
Runs on every push and pull request to master branch.

**Jobs:**
- **Test**: Runs Playwright tests across multiple Node.js versions (18.x, 20.x)
- **Lint**: Code quality checks and syntax validation  
- **Security**: npm audit and secret scanning
- **Build**: Creates production build artifacts
- **Performance**: Lighthouse CI performance testing

### 2. Claude Assistant (`claude.yml`)
Integrates with Claude GitHub App for AI-assisted code reviews and issue responses.

**Triggers:**
- Issues mentioning `@claude`
- Pull request comments with `@claude`
- Automatically runs tests after Claude makes changes

### 3. Deployment (`deploy.yml`)
Deploys to production on master branch pushes or manual dispatch.

**Features:**
- Environment-specific deployments (staging/production)
- Health checks and deployment verification
- Artifact creation and retention

## Setup Requirements

### 1. Repository Secrets
Add these secrets in GitHub Settings → Secrets and variables → Actions:

```
ANTHROPIC_API_KEY          # For Claude GitHub App integration
LHCI_GITHUB_APP_TOKEN     # Optional: For Lighthouse CI uploads
```

### 2. Environment Setup
The CI pipeline expects:
- Node.js 18.x or 20.x
- PostgreSQL database (configured via environment variables)
- Application running on port 3001

### 3. Local Development Scripts
```bash
npm run test          # Run all Playwright tests
npm run test:ci       # Run tests in CI mode with HTML reporter
npm run test:ui       # Run tests with Playwright UI
npm run lint          # Check JavaScript syntax
npm run audit         # Run security audit
npm run health        # Check if application is running
```

## Test Configuration

### Playwright Configuration
- **Browsers**: Chrome, Firefox, Safari, Mobile Chrome
- **Base URL**: http://localhost:3001
- **Timeout**: 30 seconds per test
- **Retries**: 2 retries in CI, 0 locally
- **Artifacts**: Screenshots on failure, videos on failure, traces on retry

### Performance Testing
- **Tool**: Lighthouse CI
- **Thresholds**:
  - Performance: 70% (warning)
  - Accessibility: 90% (error)
  - Best Practices: 80% (warning)
  - SEO: 80% (warning)

## Deployment Process

1. **Automated Deployment**: Triggered on push to master
2. **Manual Deployment**: Use "Deploy to Production" workflow
3. **Health Checks**: Verifies application startup and API endpoints
4. **Artifact Creation**: Packages application for deployment
5. **Post-deployment**: Verification and monitoring

## Monitoring and Artifacts

- **Test Reports**: Stored for 30 days
- **Screenshots**: Stored for 7 days on test failures  
- **Deployment Packages**: Stored for 90 days
- **Performance Reports**: Available via Lighthouse CI

## Security Features

- **Dependency Scanning**: npm audit on every build
- **Secret Detection**: Scans for hardcoded credentials
- **Code Quality**: Checks for console.log and TODO comments
- **Automated Updates**: Dependabot for dependency updates

## Usage with Claude GitHub App

1. **Issue Resolution**: Tag `@claude` in issues for AI assistance
2. **Code Review**: Tag `@claude` in PR comments for automated reviews
3. **Bug Fixes**: Claude can automatically create PRs to fix issues
4. **Documentation**: Ask Claude to update docs and comments

## Troubleshooting

### Common CI Failures

1. **Test Failures**: Check Playwright report artifacts
2. **Health Check Failures**: Ensure server starts correctly on port 3001
3. **Security Failures**: Review npm audit output and remove hardcoded secrets
4. **Deployment Failures**: Check environment configuration and credentials

### Local Development

```bash
# Start the application
npm start

# Run health check
npm run health

# Run tests locally
npm test

# Debug test issues
npm run test:debug
```

## Contributing

1. Create feature branch from master
2. Make changes and add tests
3. Ensure CI pipeline passes
4. Create pull request
5. Use `@claude` for AI-assisted review if needed

All pull requests must pass the CI pipeline before merging to master.