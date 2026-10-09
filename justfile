# Show available recipes.
default:
    @just --list

# Check JavaScript syntax and parse the extension manifest.
lint:
    node --check content.js
    node --check tests/content.test.js
    node -e 'JSON.parse(require("node:fs").readFileSync("manifest.json", "utf8"))'

# Run the URL and DOM behavior checks.
test:
    node --test tests/*.test.js

# Run all checks used by local development and CI.
check: lint test

# Build an unsigned XPI for local testing or AMO submission.
version := `node -p "require('./manifest.json').version"`
build:
    mkdir -p dist
    zip -q -j -FS "dist/google-images-for-you-hider-{{version}}.xpi" manifest.json content.js content.css
