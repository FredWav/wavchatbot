# Git Hooks for Fred Wav Chatbot

This directory contains custom Git hooks that automate common development tasks.

## Available Hooks

### `post-commit`
Automatically pushes commits to the remote repository after each commit.

**Features:**
- ✅ Auto-push on `main` and `develop` branches
- ✅ Auto-push on `copilot/*` branches  
- ⚠️ Disabled on feature branches (manual push required)
- 🎨 Colored output with status indicators
- ❌ Error handling with helpful messages

**Behavior:**
```bash
# On main/develop branches
git commit -m "feat: new feature"
# → Automatically runs: git push -u origin main

# On feature branches  
git commit -m "wip: work in progress"
# → No auto-push, manual push required
```

## Setup Instructions

### Option 1: Automatic Setup (Recommended)
```bash
# Run the setup script
./.githooks/setup.sh
```

### Option 2: Manual Setup
```bash
# Configure Git to use custom hooks directory
git config core.hooksPath .githooks

# Make hooks executable
chmod +x .githooks/*
```

## Usage

Once configured, hooks run automatically:

```bash
# This will auto-push (on main/develop)
git add .
git commit -m "feat: implement new feature"
# 🚀 Hook automatically pushes to remote

# This won't auto-push (on feature branch)
git checkout -b feature/my-feature
git commit -m "wip: working on feature"
# ⚠️ Manual push required: git push origin feature/my-feature
```

## Customization

### Enable Auto-push for Additional Branches
Edit `.githooks/post-commit` and add branches to the condition:

```bash
if [ "$branch" = "main" ] || [ "$branch" = "develop" ] || [ "$branch" = "staging" ]; then
    # Auto-push enabled
fi
```

### Disable Hooks Temporarily
```bash
# Disable all hooks
git config core.hooksPath ""

# Re-enable hooks
git config core.hooksPath .githooks
```

### Add New Hooks
1. Create new hook file in `.githooks/`
2. Make it executable: `chmod +x .githooks/hook-name`
3. See Git documentation for available hooks

## Troubleshooting

### Hook Not Running
```bash
# Check hooks path configuration
git config core.hooksPath
# Should return: .githooks

# Check file permissions
ls -la .githooks/
# Should show: -rwxr-xr-x (executable)
```

### Push Failures
The post-commit hook will show error messages if push fails:

```bash
❌ Failed to push to origin/main
⚠️  You may need to pull latest changes first:
   git pull origin main
   git push origin main
```

### Hook Conflicts
If you have existing Git hooks:
1. Backup your current hooks: `cp -r .git/hooks .git/hooks.backup`
2. Run setup script: `./.githooks/setup.sh`
3. Merge custom logic if needed

## Security Notes

- ⚠️ Hooks are not version controlled in destination repos (security feature)
- ✅ Each team member must run setup individually  
- 🔒 Hooks cannot be pushed to collaborators automatically
- 💡 Document hook setup in onboarding process

## Integration with Development Workflow

### Fred Wav Development Process
1. **Feature Development**: Work on feature branches (no auto-push)
2. **Ready for Review**: Manual push to trigger CI/CD  
3. **Merge to Develop**: Auto-push keeps develop updated
4. **Release**: Merge to main → Auto-push → Production deployment

### Benefits
- 🚀 **Faster workflow**: No manual push on main branches
- 🛡️ **Safety**: Feature branches require deliberate push
- 🔄 **Consistency**: Main/develop always stay synced
- 📊 **CI/CD**: Immediate trigger of build pipelines

---

**💡 Pro Tip**: Combine with `report_progress` tool in Copilot for atomic commit+push operations!