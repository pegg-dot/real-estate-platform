# Contributing to LOT

Thanks for taking an interest in LOT.

## Before opening a pull request

- Keep real credentials, OAuth secrets, provider keys, database dumps, and private keys out of Git.
- Do not commit real owner contact data or private user data as fixtures. Use conspicuously synthetic records in tests and screenshots.
- Keep sourced observations distinguishable from modeled assumptions.
- Do not remove legal, zoning, occupancy, lending, or other screening guardrails merely to improve a modeled return.
- Avoid making live provider calls from tests when a deterministic fixture can establish the behavior safely.
- Run the repository verification workflows for changes that affect application behavior.

## Pull requests

A useful pull request explains:

1. what problem it solves,
2. which workflows or routes changed,
3. what was tested,
4. whether any external provider, credential, schema, or deployment behavior changed.

Small, reviewable changes are preferred over unrelated bundles.

## Security issues

Do not disclose credentials, private data, or a working exploit in a public issue. Follow [`SECURITY.md`](SECURITY.md) instead.

## License and attribution

By contributing, you agree that your contribution can be distributed under the repository's MIT License. The project copyright notice and MIT permission notice remain part of copies or substantial portions of the software.
