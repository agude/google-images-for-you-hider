# Project guidance

This repository contains a small Firefox Manifest V3 extension with no runtime
dependencies.

## Checks and packaging

- Run `just check` after changing source or manifest files.
- Run `just build` to create an unsigned XPI in `dist/`.
- Keep quality-check commands in `justfile`; CI calls `just check`.
- The XPI is a local build artifact. Mozilla signing is a separate release step.

## Behavior and privacy

- Hide the For You gallery only when `udm=49`, `udf=257`, and the URL has no
  `q` parameter.
- Keep ordinary image searches with a `q` parameter visible.
- Keep the extension self-contained. It must not collect or transmit browsing
  data, load remote code, or add permissions unrelated to this behavior.
- Update the manifest version for each release submission.
- There is no release workflow yet. AMO signing and publication remain manual
  until a distribution channel and credentials are configured.
