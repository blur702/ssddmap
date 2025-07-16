# ESLint and Code Quality Guide

## 🎯 Overview

This project uses **ESLint** with the Standard JavaScript style guide to ensure consistent, high-quality code across the entire codebase.

## 🚀 Linting Integration Points

### **1. Real-time (Editor)**
- ✅ **VS Code**: Auto-lint and auto-fix on save
- ✅ **Extensions**: ESLint extension recommended
- ✅ **Configuration**: `.vscode/settings.json` pre-configured

### **2. Pre-commit (Local)**
- ✅ **Git hooks**: ESLint runs before each commit
- ✅ **Staged files**: Only lints changed files
- ✅ **Auto-block**: Prevents commits with linting errors

### **3. CI/CD (GitHub)**
- ✅ **On-commit**: Quick lint check on push
- ✅ **Full pipeline**: Comprehensive code quality analysis
- ✅ **Pull requests**: Blocks merging if linting fails

## 📋 npm Scripts

```bash
# Check for issues (no fixing)
npm run lint:check

# Show issues and auto-fix what's possible
npm run lint:fix

# Preview fixes without applying them
npm run lint

# Lint specific files (used by pre-commit hook)
npm run lint:staged
```

## ⚙️ ESLint Configuration

### **Base Rules** (Standard JavaScript)
- **Indentation**: 2 spaces
- **Quotes**: Single quotes
- **Semicolons**: Required
- **Line endings**: Unix (LF)
- **Trailing spaces**: Not allowed

### **Custom Rules**
- **console.log**: Warning (allowed in server, not in frontend)
- **Unused variables**: Error
- **Undefined variables**: Error
- **Camelcase**: Enforced
- **Prefer const**: Required over let/var

### **Environment-specific Rules**

#### **Frontend (`public/js/`)**
```javascript
// Globals available
L          // Leaflet maps
turf       // Turf.js geospatial
fetch      // Fetch API
```

#### **Backend (`server.js`, `services/`)**
```javascript
// console.log allowed
// Node.js environment
// CommonJS modules
```

#### **Tests (`tests/`)**
```javascript
// Playwright globals
test, expect, page, browser, context
// console.log allowed for debugging
```

## 🔧 Editor Setup

### **VS Code (Recommended)**

1. **Install Extensions**:
   ```bash
   # Extensions will be suggested automatically
   # Or install manually:
   code --install-extension dbaeumer.vscode-eslint
   ```

2. **Configuration Applied Automatically**:
   - Auto-fix on save
   - Format on save
   - ESLint validation
   - Trim trailing whitespace

### **Other Editors**

#### **WebStorm/IntelliJ**
- ESLint integration built-in
- Enable "ESLint" in Preferences → Languages → JavaScript → Code Quality Tools

#### **Vim/Neovim**
```vim
" Add to .vimrc
Plug 'dense-analysis/ale'
let g:ale_linters = {'javascript': ['eslint']}
let g:ale_fixers = {'javascript': ['eslint']}
```

#### **Emacs**
```elisp
;; Add to .emacs
(require 'flycheck)
(add-hook 'js-mode-hook 'flycheck-mode)
```

## 🛠️ Common Linting Issues & Solutions

### **1. Indentation Errors**
```javascript
// ❌ Wrong (4 spaces)
function example() {
    return true;
}

// ✅ Correct (2 spaces)
function example () {
  return true;
}
```

### **2. Quote Style**
```javascript
// ❌ Wrong
const message = "Hello world";

// ✅ Correct
const message = 'Hello world';
```

### **3. Semicolons**
```javascript
// ❌ Wrong
const value = getValue()
const result = process(value)

// ✅ Correct
const value = getValue();
const result = process(value);
```

### **4. Unused Variables**
```javascript
// ❌ Wrong
function calculate(a, b, c) {
  return a + b; // 'c' is unused
}

// ✅ Correct
function calculate(a, b) {
  return a + b;
}
```

### **5. Console Statements (Frontend)**
```javascript
// ❌ Wrong (in frontend files)
console.log('Debug info');

// ✅ Correct (use proper logging or remove)
// Remove for production, or use proper logging
```

## 🚨 Bypassing Linting (Emergency Only)

### **Single Line**
```javascript
// eslint-disable-next-line no-console
console.log('Emergency debug');
```

### **Entire File**
```javascript
/* eslint-disable */
// Legacy code that can't be fixed immediately
/* eslint-enable */
```

### **Specific Rules**
```javascript
/* eslint-disable no-unused-vars, no-console */
// Code with known issues
/* eslint-enable no-unused-vars, no-console */
```

### **Git Commit Bypass**
```bash
# Only for emergencies
git commit --no-verify -m "Emergency fix"

# Or use npm script
npm run commit:force
```

## 📊 Linting Reports

### **Command Line**
```bash
# Basic report
npm run lint:check

# Detailed JSON report
npx eslint . --format=json > lint-report.json

# HTML report
npx eslint . --format=html > lint-report.html
```

### **CI/CD Reports**
- GitHub Actions shows linting results in workflow logs
- Failed linting blocks pull request merging
- Detailed error messages with file locations

## 🎯 Best Practices

### **For Developers**
1. **Enable auto-fix on save** in your editor
2. **Run `npm run lint:fix`** before committing
3. **Address warnings** as well as errors
4. **Don't bypass linting** unless absolutely necessary

### **For Teams**
1. **Consistent editor setup** across team members
2. **Regular linting rule reviews** in team meetings
3. **Address technical debt** highlighted by linting
4. **Update rules** as coding standards evolve

### **For Maintenance**
1. **Regular ESLint updates** via `npm update`
2. **Rule refinement** based on project needs
3. **Performance monitoring** of linting in CI/CD
4. **Documentation updates** when rules change

## 🔄 Workflow Integration

### **Development Cycle**
```
Write Code → Editor Auto-fix → Save → Pre-commit Lint → Commit → Push → CI Lint → Merge
```

### **Error Resolution**
```
Lint Error → npm run lint:fix → Manual fixes → Test → Commit
```

## 📈 Linting Metrics

Track these metrics to improve code quality:
- **Error count trends** over time
- **Most common rule violations**
- **Time spent fixing linting issues**
- **Developer productivity impact**

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run lint:check` | Check for issues only |
| `npm run lint:fix` | Fix auto-fixable issues |
| `npm run lint` | Preview fixes |
| `git commit --no-verify` | Bypass pre-commit linting |
| `.eslintrc.json` | Main configuration file |
| `.eslintignore` | Files to exclude from linting |

**Remember**: Linting is your friend! It catches bugs early and ensures consistent, maintainable code. 🛡️