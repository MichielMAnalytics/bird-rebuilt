#!/usr/bin/env bash
set -euo pipefail

# Install the bird skill for Claude Code
# Usage: ./setup-skill.sh

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$HOME/.claude/skills/bird"
CLI_PATH="node $REPO_DIR/dist/cli.js"

echo "=== bird-rebuilt skill setup ==="
echo ""

# 1. Build if needed
if [ ! -f "$REPO_DIR/dist/cli.js" ]; then
  echo "Building bird-rebuilt..."
  cd "$REPO_DIR" && npm install && npm run build
  cd - > /dev/null
else
  echo "Build found at $REPO_DIR/dist/cli.js"
fi

# 2. Copy skill
mkdir -p "$SKILL_DIR"
cp "$REPO_DIR/skills/bird/SKILL.md" "$SKILL_DIR/SKILL.md"
echo "Skill installed to $SKILL_DIR"

# 3. Patch in the resolved CLI path
sed -i.bak "s|export BIRD_CLI=.*|export BIRD_CLI=\"$CLI_PATH\"|" "$SKILL_DIR/SKILL.md"
rm -f "$SKILL_DIR/SKILL.md.bak"

echo ""
echo "Done! To finish setup:"
echo ""
echo "  1. Add to your shell profile (~/.zshrc or ~/.bashrc):"
echo "     export AUTH_TOKEN=<your_auth_token>"
echo "     export CT0=<your_ct0>"
echo "     export BIRD_CLI=\"$CLI_PATH\""
echo ""
echo "  2. Get AUTH_TOKEN and CT0 from:"
echo "     Chrome > x.com > DevTools > Application > Cookies"
echo ""
echo "  3. Restart Claude Code. Then use /bird or just ask to tweet."
