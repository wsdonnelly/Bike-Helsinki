#!/bin/sh
HOOKS_DIR=".git/hooks"
SCRIPTS_DIR="scripts/hooks"

cp "$SCRIPTS_DIR/prepare-commit-msg" "$HOOKS_DIR/prepare-commit-msg"
chmod +x "$HOOKS_DIR/prepare-commit-msg"
echo "Git hooks installed."
