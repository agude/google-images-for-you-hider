# Show available recipes.
default:
    @just --list

# Check JavaScript syntax and parse the extension manifest.
lint:
    node --check content.js
    node --check tests/content.test.js
    node -e 'JSON.parse(require("node:fs").readFileSync("manifest.json", "utf8"))'

# Validate the files that ship in the XPI with Mozilla's linter.
# Use public AMO validation for the listed submission target.
lint-package:
    #!/usr/bin/env bash
    set -euo pipefail
    stage="$(mktemp -d)"
    trap 'rm -rf "$stage"' EXIT
    cp manifest.json content.js content.css "$stage"
    node_modules/.bin/web-ext lint --warnings-as-errors --source-dir "$stage"

# Run the URL and DOM behavior checks.
test:
    node --test tests/*.test.js

# Run all checks used by local development and CI.
check: lint lint-package test

# Build an unsigned XPI for local testing or AMO submission.
version := `node -p "require('./manifest.json').version"`
build:
    mkdir -p dist
    zip -q -j -FS "dist/google-images-for-you-hider-{{version}}.xpi" manifest.json content.js content.css
