# Security policy

LOT is a self-hosted real-estate research and acquisition tool. It can connect to PostgreSQL, public county data, optional AI/data providers, Google OAuth, Gmail/Calendar connectors, and user-configured deployment infrastructure.

No software is perfectly secure. This document defines the supported security boundary and how to report a problem.

## Reporting a vulnerability

Please do **not** open a public issue containing credentials, private data, exploit details, or a working proof of concept against someone else's deployment.

Preferred reporting path:

1. Use GitHub private vulnerability reporting from the repository's **Security** tab if the feature is enabled.
2. Otherwise, contact the repository owner privately through GitHub. If no private channel is available, open a minimal issue requesting a private contact method without including exploit details.

A useful report includes the affected route/component, impact, reproduction conditions, and the smallest proof necessary to establish the problem.

## Most important deployment boundary

The default Docker configuration is for a **single-user local machine** and does not enable authentication.

The committed Docker Compose configuration binds the application to `127.0.0.1` by default and does not publish the PostgreSQL port. That reduces accidental network exposure, but it does not turn the zero-login configuration into a safe public deployment.

Before using a public/shared hostname:

- enable authentication,
- configure an explicit user allowlist,
- use HTTPS,
- set the canonical public origin,
- use a dedicated least-privilege database credential,
- keep the database off the public internet where practical,
- store credentials in the hosting provider's encrypted secret/environment system.

## Secret and private-data handling

Never commit:

- `.env` or production environment files,
- PostgreSQL credentials or production connection strings,
- Anthropic or third-party provider API keys,
- Google OAuth client secrets,
- authentication/session secrets,
- connector encryption secrets,
- service-account JSON,
- private keys or certificates,
- private database files, dumps, or exports,
- real owner contact data used only for a private deployment.

`.env.example` contains names and empty/safe example values only.

The repository includes `scripts/check-public-tree.sh`, which blocks a narrow set of high-confidence credential patterns and sensitive tracked file types in CI. It is a defense-in-depth check, **not a substitute for GitHub secret scanning and push protection**.

If a credential is accidentally committed, deleting it in a later commit is not sufficient. Rotate or revoke it first, then remove it from the active tree and assess repository history.

## Automated verification

Pull requests and `main` builds exercise multiple independent controls:

- root and web dependency audits at high severity,
- TypeScript and unit tests,
- a production Next.js build,
- a clean Docker/PostgreSQL boot with database health and migration checks,
- migration idempotence after restart,
- production-browser regressions using synthetic records,
- the public-tree secret/private-file policy,
- CodeQL analysis for JavaScript/TypeScript and Python.

GitHub Actions workflows use read-only repository permissions unless a workflow explicitly requires an additional scoped permission. Checkout credentials are not persisted, and committed third-party Actions are pinned to immutable commit SHAs.

These checks materially reduce risk but do not prove that every route, dependency, provider, deployment, or historical commit is secure.

## GitHub repository controls

For the public repository, the recommended repository-admin configuration is:

- protect `main` with a branch rule/ruleset,
- require pull requests for changes to `main`,
- require the self-host, interface, and CodeQL checks to pass,
- block force-pushes and branch deletion,
- enable GitHub secret scanning and push protection,
- enable private vulnerability reporting,
- keep account two-factor authentication or a passkey enabled.

Those are GitHub account/repository settings rather than source files, so contributors should not assume their presence solely because this policy recommends them.

## External input and providers

County/public APIs and configured third-party providers are external systems. Their responses should be treated as untrusted data rather than executable instructions.

A data source appearing in LOT does not make that source part of LOT's security-testing scope. Do not use this project to probe or attack county systems, vendors, Google, Anthropic, Mapbox, GitHub, or other third parties.

## AI boundary

AI-powered features are optional. Core parcel ingestion, deterministic scoring, financing analysis, and self-hosted operation should not depend on an AI key.

Model output is generated analysis, not an authorization mechanism or a substitute for legal, lending, tax, title, fair-housing, or investment advice. Do not put secrets into prompts or untrusted documents unless a configured workflow explicitly requires that data.

## Good-faith testing

Please avoid denial-of-service/high-volume testing against deployments you do not own, attempts to access another user's email/calendar/database/tokens, automated abuse of county endpoints, publication of credentials or sensitive exploit details, and social engineering of property owners or service providers.

## Legal and financial boundary

LOT produces research and analytical outputs. Creative-finance scenarios can involve state-specific law, licensing, lender restrictions, due-on-sale clauses, disclosures, title, tax, fair-housing, and other legal obligations.

A software-generated financing structure is not legal or financial advice and should not be treated as permission to execute a transaction.

## License

Security research does not change the software license. Use and redistribution of the source remain governed by the repository's MIT License.
