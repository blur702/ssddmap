#!/bin/bash

# Git Hooks Installation Script for SSDD Mapping Application
# This script installs Git hooks to trigger testing on commits

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INSTALL]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_status "Installing Git hooks for SSDD Mapping Application..."

# Check if we're in a Git repository
if [ ! -d ".git" ]; then
    print_error "Not in a Git repository. Please run this script from the project root."
    exit 1
fi

# Check if hooks directory exists
if [ ! -d "hooks" ]; then
    print_error "Hooks directory not found. Please ensure you're in the correct project directory."
    exit 1
fi

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Function to install a hook
install_hook() {
    local hook_name=$1
    local hook_file="hooks/$hook_name"
    local git_hook_file=".git/hooks/$hook_name"
    
    if [ ! -f "$hook_file" ]; then
        print_warning "Hook file $hook_file not found, skipping..."
        return 1
    fi
    
    # Backup existing hook if it exists
    if [ -f "$git_hook_file" ]; then
        print_warning "Existing $hook_name hook found, backing up to $git_hook_file.backup"
        mv "$git_hook_file" "$git_hook_file.backup"
    fi
    
    # Copy and make executable
    cp "$hook_file" "$git_hook_file"
    chmod +x "$git_hook_file"
    
    print_success "$hook_name hook installed"
    return 0
}

# Install pre-commit hook
print_status "Installing pre-commit hook..."
if install_hook "pre-commit"; then
    print_status "Pre-commit hook will run tests before each commit"
fi

# Install post-commit hook
print_status "Installing post-commit hook..."
if install_hook "post-commit"; then
    print_status "Post-commit hook will run additional checks after each commit"
fi

# Add npm scripts for hook management
print_status "Updating package.json with hook management scripts..."

# Check if package.json exists
if [ ! -f "package.json" ]; then
    print_error "package.json not found"
    exit 1
fi

# Add hook-related scripts to package.json using Node.js
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Add hook management scripts
pkg.scripts = pkg.scripts || {};
pkg.scripts['hooks:install'] = './install-hooks.sh';
pkg.scripts['hooks:uninstall'] = './uninstall-hooks.sh';
pkg.scripts['hooks:test'] = 'echo \"Testing hooks...\" && npm run lint && npm run health';
pkg.scripts['commit:safe'] = 'git add -A && git commit';
pkg.scripts['commit:force'] = 'git add -A && git commit --no-verify';

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

print_success "Added hook management scripts to package.json"

# Create uninstall script
print_status "Creating uninstall script..."
cat > uninstall-hooks.sh << 'EOF'
#!/bin/bash

# Git Hooks Uninstallation Script

print_status() {
    echo -e "\033[0;34m[UNINSTALL]\033[0m $1"
}

print_success() {
    echo -e "\033[0;32m✅ $1\033[0m"
}

print_status "Uninstalling Git hooks..."

# Remove hooks
for hook in pre-commit post-commit; do
    if [ -f ".git/hooks/$hook" ]; then
        rm ".git/hooks/$hook"
        print_success "Removed $hook hook"
        
        # Restore backup if exists
        if [ -f ".git/hooks/$hook.backup" ]; then
            mv ".git/hooks/$hook.backup" ".git/hooks/$hook"
            print_success "Restored $hook backup"
        fi
    fi
done

print_success "Git hooks uninstalled"
EOF

chmod +x uninstall-hooks.sh
print_success "Created uninstall-hooks.sh"

# Test the installation
print_status "Testing hook installation..."

if [ -x ".git/hooks/pre-commit" ]; then
    print_success "Pre-commit hook is executable"
else
    print_error "Pre-commit hook installation failed"
    exit 1
fi

if [ -x ".git/hooks/post-commit" ]; then
    print_success "Post-commit hook is executable"
else
    print_error "Post-commit hook installation failed"
    exit 1
fi

# Show usage information
echo ""
print_success "Git hooks installed successfully!"
echo ""
echo "📖 Usage Information:"
echo ""
echo "Available npm scripts:"
echo "  npm run hooks:install   - Install Git hooks"
echo "  npm run hooks:uninstall - Uninstall Git hooks"
echo "  npm run hooks:test      - Test hook functionality"
echo "  npm run commit:safe     - Stage all and commit with hooks"
echo "  npm run commit:force    - Stage all and commit without hooks"
echo ""
echo "Git hook behavior:"
echo "  📝 Pre-commit:  Runs tests before allowing commits"
echo "  📋 Post-commit: Shows commit info and suggestions"
echo ""
echo "To bypass hooks temporarily:"
echo "  git commit --no-verify -m \"Your message\""
echo ""
echo "To test the hooks:"
echo "  1. Make a small change to a file"
echo "  2. Run: git add . && git commit -m \"Test commit\""
echo "  3. Watch the hooks run automatically"
echo ""
print_warning "Note: Pre-commit hooks may take a few minutes as they run tests"
print_status "Consider running 'npm test' manually first to install Playwright browsers"

exit 0