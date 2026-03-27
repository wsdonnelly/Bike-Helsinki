#!/bin/sh
HOOKS_DIR=".git/hooks"
SCRIPTS_DIR="scripts/hooks"

cp "$SCRIPTS_DIR/prepare-commit-msg" "$HOOKS_DIR/prepare-commit-msg"
chmod +x "$HOOKS_DIR/prepare-commit-msg"

cp "$SCRIPTS_DIR/pre-push" "$HOOKS_DIR/pre-push"
chmod +x "$HOOKS_DIR/pre-push"

cp "$SCRIPTS_DIR/post-checkout" "$HOOKS_DIR/post-checkout"
chmod +x "$HOOKS_DIR/post-checkout"

echo "Git hooks installed."
