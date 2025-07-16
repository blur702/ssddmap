# Git Hooks Guide for SSDD Mapping Application

## Overview

This repository includes Git hooks that automatically trigger testing and quality checks on commits, ensuring code quality and preventing broken commits.

## Available Hooks

### 🔍 Pre-commit Hook
**Triggers**: Before each commit is finalized
**Purpose**: Prevent broken code from being committed

**What it does:**
- ✅ Syntax checking for all JavaScript files
- ✅ Basic security scanning for hardcoded secrets
- ✅ Starts application server and verifies it works
- ✅ Runs critical test suite (basic load and error tests)
- ✅ Health check verification
- ⚠️ Warnings for console.log and TODO comments

**Time**: ~2-5 minutes (includes server startup and testing)

### 📋 Post-commit Hook
**Triggers**: After each successful commit
**Purpose**: Provide feedback and next steps

**What it does:**
- 📊 Shows commit information and changed files
- 🔒 Additional security checks on committed content
- ⚠️ Warnings for significant changes or dependencies
- 💡 Suggestions for next steps (push, test, etc.)
- 🏥 Background npm audit

**Time**: ~30 seconds

## Installation

### Automatic Installation
```bash
# Install hooks
./install-hooks.sh

# Or using npm
npm run hooks:install
```

### Manual Installation
```bash
# Copy hooks to .git/hooks/
cp hooks/pre-commit .git/hooks/pre-commit
cp hooks/post-commit .git/hooks/post-commit
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/post-commit
```

## Usage

### Normal Workflow
```bash
# Make changes
git add .
git commit -m "Your commit message"
# Hooks run automatically
```

### Available npm Scripts
```bash
npm run hooks:install     # Install Git hooks
npm run hooks:uninstall   # Remove Git hooks
npm run hooks:test        # Test hook functionality
npm run commit:safe       # Stage all and commit with hooks
npm run commit:force      # Stage all and commit without hooks
```

### Bypassing Hooks
```bash
# Bypass all hooks (not recommended)
git commit --no-verify -m "Emergency commit"

# Or use the npm script
npm run commit:force
```

## Hook Behavior Details

### Pre-commit Hook Flow
1. **Environment Check**: Verify Node.js, npm, project structure
2. **Dependency Check**: Install dependencies if missing
3. **Syntax Validation**: Check all JavaScript files for syntax errors
4. **Security Scan**: Look for hardcoded secrets and common issues
5. **Server Start**: Launch application on port 3001
6. **Health Check**: Verify application responds correctly
7. **Quick Tests**: Run critical test suite (2-3 key tests)
8. **Cleanup**: Stop server and clean up

### What Causes Pre-commit to Fail
- ❌ JavaScript syntax errors
- ❌ Hardcoded secrets detected
- ❌ Server fails to start
- ❌ Health check fails
- ❌ Critical tests fail

### Post-commit Information
- 📝 Commit hash, author, date
- 📁 List of changed files
- ⚠️ Warnings for specific file types:
  - `package.json` changes → suggest `npm ci`
  - Test file changes → suggest running full test suite
  - Server code changes → suggest manual testing
  - Workflow changes → note CI/CD updates
- 🔒 Security scan results
- 💡 Suggested next steps

## CI/CD Integration

### GitHub Actions Workflows
The hooks work alongside GitHub Actions:

1. **Local Pre-commit**: Quick tests before commit
2. **On-commit Workflow**: Immediate testing when pushed to GitHub
3. **Full CI Pipeline**: Comprehensive testing (all browsers, security, performance)

### Workflow Sequence
```
Local Development → Pre-commit Hook → Commit → Post-commit Hook → 
Push to GitHub → On-commit Tests → Full CI Pipeline
```

## Troubleshooting

### Common Issues

#### Hook Takes Too Long
- **Cause**: First run installs Playwright browsers
- **Solution**: Run `npm test` once manually to pre-install

#### Server Fails to Start
- **Cause**: Port 3001 already in use or dependencies missing
- **Solution**: 
  ```bash
  killall node  # Kill any running Node processes
  npm ci        # Reinstall dependencies
  ```

#### Tests Fail
- **Cause**: Code changes broke functionality
- **Solution**: Fix the issues or run full test suite to see details
  ```bash
  npm test  # See detailed test results
  ```

#### Permission Denied
- **Cause**: Hooks not executable
- **Solution**: 
  ```bash
  chmod +x .git/hooks/pre-commit
  chmod +x .git/hooks/post-commit
  ```

### Debug Mode
Run hooks manually for debugging:
```bash
# Test pre-commit hook
.git/hooks/pre-commit

# Test post-commit hook
.git/hooks/post-commit
```

### Hook Logs
Check hook output for detailed information:
- Pre-commit shows step-by-step progress
- Post-commit provides commit analysis
- Both use colored output for easy reading

## Configuration

### Customizing Pre-commit Tests
Edit `hooks/pre-commit` to modify:
- Which tests to run (line ~120)
- Timeout values (line ~85)
- Security check patterns (line ~65)

### Customizing Post-commit Behavior
Edit `hooks/post-commit` to modify:
- Information displayed
- Security checks
- Notification behavior

### Environment Variables
Set these to customize behavior:
```bash
export SKIP_HOOKS=1        # Skip all hooks
export QUICK_COMMIT=1      # Skip time-consuming checks
export DEBUG_HOOKS=1       # Verbose hook output
```

## Best Practices

### For Developers
1. **Run `npm test` once** after cloning to install Playwright
2. **Don't bypass hooks** unless absolutely necessary
3. **Fix issues** rather than using `--no-verify`
4. **Read post-commit suggestions** for next steps

### For Teams
1. **Install hooks** on all development machines
2. **Document any customizations** in team guidelines
3. **Review hook failures** in team meetings
4. **Update hooks** as testing requirements change

### For CI/CD
1. **Hooks complement** but don't replace CI/CD
2. **Local hooks are faster** than remote CI
3. **Use hooks for quick feedback** before pushing
4. **Rely on full CI** for comprehensive testing

## Maintenance

### Updating Hooks
```bash
# Re-run installation after pulling hook changes
./install-hooks.sh

# Or manually copy updated hooks
cp hooks/* .git/hooks/
chmod +x .git/hooks/*
```

### Removing Hooks
```bash
# Use uninstall script
./uninstall-hooks.sh

# Or use npm script
npm run hooks:uninstall

# Or remove manually
rm .git/hooks/pre-commit .git/hooks/post-commit
```

### Monitoring Hook Performance
- Check hook execution time in terminal output
- Monitor test results for pattern changes
- Review post-commit suggestions for workflow improvements

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `./install-hooks.sh` | Install Git hooks |
| `./uninstall-hooks.sh` | Remove Git hooks |
| `git commit --no-verify` | Bypass hooks |
| `npm run hooks:test` | Test hook functionality |
| `npm test` | Run full test suite |
| `.git/hooks/pre-commit` | Run pre-commit manually |

**Remember**: Hooks are your friends! They catch issues early and save time by preventing broken commits. 🛡️