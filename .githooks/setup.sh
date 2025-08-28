#!/bin/bash
# Fred Wav Chatbot - Git hooks setup script
# This script configures Git to use custom hooks from .githooks directory

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "${BLUE}🔧 Fred Wav Chatbot - Git Hooks Setup${NC}"
echo "================================================"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "${RED}❌ Error: Not in a Git repository${NC}"
    exit 1
fi

# Get the root directory of the git repo
repo_root=$(git rev-parse --show-toplevel)
hooks_dir="$repo_root/.githooks"

echo "📁 Repository root: $repo_root"
echo "🪝 Hooks directory: $hooks_dir"

# Check if .githooks directory exists
if [ ! -d "$hooks_dir" ]; then
    echo "${RED}❌ Error: .githooks directory not found${NC}"
    echo "💡 Expected location: $hooks_dir"
    exit 1
fi

# Configure Git to use the custom hooks directory
echo "${YELLOW}⚙️  Configuring Git hooks path...${NC}"

if git config core.hooksPath .githooks; then
    echo "${GREEN}✅ Git hooks path configured successfully${NC}"
else
    echo "${RED}❌ Failed to configure Git hooks path${NC}"
    exit 1
fi

# Make all hook files executable
echo "${YELLOW}🔐 Making hook files executable...${NC}"

hook_count=0
for hook_file in "$hooks_dir"/*; do
    if [ -f "$hook_file" ]; then
        filename=$(basename "$hook_file")
        echo "  📄 Making $filename executable..."
        
        if chmod +x "$hook_file"; then
            echo "    ${GREEN}✅ $filename${NC}"
            hook_count=$((hook_count + 1))
        else
            echo "    ${RED}❌ $filename${NC}"
        fi
    fi
done

echo "${GREEN}✅ Made $hook_count hook file(s) executable${NC}"

# Test the hooks setup
echo "${YELLOW}🧪 Testing hooks setup...${NC}"

current_hooks_path=$(git config core.hooksPath)
if [ "$current_hooks_path" = ".githooks" ]; then
    echo "${GREEN}✅ Hooks path correctly configured: $current_hooks_path${NC}"
else
    echo "${RED}❌ Hooks path configuration error${NC}"
    echo "Expected: .githooks"
    echo "Actual: $current_hooks_path"
    exit 1
fi

# List available hooks
echo "${BLUE}📋 Available hooks:${NC}"
for hook_file in "$hooks_dir"/*; do
    if [ -f "$hook_file" ]; then
        filename=$(basename "$hook_file")
        if [ -x "$hook_file" ]; then
            echo "  ${GREEN}✅ $filename${NC} (executable)"
        else
            echo "  ${YELLOW}⚠️  $filename${NC} (not executable)"
        fi
    fi
done

echo ""
echo "${GREEN}🎉 Git hooks setup completed successfully!${NC}"
echo ""
echo "${BLUE}📖 What this enables:${NC}"
echo "  🚀 ${YELLOW}post-commit${NC}: Automatically pushes commits to remote"
echo "  🔧 ${YELLOW}Future hooks${NC}: Can be added to .githooks/ directory"
echo ""
echo "${BLUE}💡 Usage tips:${NC}"
echo "  • Hooks will run automatically on git operations"
echo "  • Auto-push works on main, develop, and copilot/* branches"
echo "  • To disable temporarily: git config core.hooksPath ''"
echo "  • To re-enable: git config core.hooksPath .githooks"
echo ""
echo "${YELLOW}⚠️  Note:${NC} Hooks are local to this repository"
echo "   Each team member needs to run this setup script"