# Security policy

LOT is a self-hosted real-estate research and acquisition tool. It can connect to PostgreSQL, public county data, optional AI/data providers, Google OAuth, Gmail/Calendar connectors, and user-configured deployment infrastructure.

No software is perfectly secure. This document defines the supported security boundary and how to report a problem.

## Reporting a vulnerability

Please do **not** open a public issue containing credentials, private data, exploit details, or a working proof of concept against someone else's deployment.

Preferred reporting path:

1. Use GitHub private vulnerability reporting from the repository's **Security** tab if available.
2. Otherwise, contact the repository owner privately through GitHub. If no private channel is available, open a minimal issue requesting a private contact method without including exploit details.

A useful report includes the affected route/component, impact, reproduction conditions, and the smallest proof necessary to establish the problem.

## The most important deployment boundary

The default Docker configuration is for a single-user local machine and **does not enable authentication**.

That is intentional for local use. It is **not safe to expose directly to the public internet**.

Before using a public/shared hostname, enable authentication, configure an explicit user allowlist, use HTTPS, set the canonical public origin, and store credentials in the hosting provider's encrypted secret/environment system.

## Secret handling

Never commit:

- `.env` or production environment files
- PostgreSQL credentials or production connection strings
- Anthropic or third-party data-provider API keys
- Google OAuth client secrets
- authentication/session secrets
- connector encryption secrets
- service-account JSON
- private keys or certificates

`.env.example` contains names and empty/safe example values only.

If a credential is accidentally committed, deleting it in a later commit is not sufficient. Rotate or revoke the credential first, then remove it from the active tree and assess repository history.

Use separate random values for separate security functions. In particular, do not reuse the authentication secret as the connector-encryption secret or as a provider API key.

## Public hosting checklist

For a shared or internet-facing deployment:

- enable `AUTH_ENABLED`
- use a strong `AUTH_SECRET`
- set a narrow `AUTH_ALLOWLIST`
- configure Google OAuth redirect URIs to the exact HTTPS `PUBLIC_BASE_URL`
- use a separate `CONNECTOR_SECRET` if Google connectors are enabled
- use a dedicated least-privilege database credential
- keep the database off the public internet where practical
- restrict inbound traffic to the application and required administrative access
- keep Docker/OS/runtime dependencies patched
- back up important PostgreSQL data and test restores
- review logs before sharing them because they can contain property, workflow, or integration context

## External input and data sources

County/public APIs and configured third-party providers are external systems. Their responses should be treated as untrusted data rather than executable instructions.

A data source appearing in LOT does not make that source part of LOT's security-testing scope. Do not use this project to probe or attack county systems, vendors, Google, Anthropic, Mapbox, GitHub, or other third parties.

## AI boundary

AI-powered features are optional. Core parcel ingestion, deterministic scoring, financing analysis, and self-hosted operation should not depend on an AI key.

Model output should be treated as generated analysis, not as an authorization mechanism or a substitute for legal, lending, tax, title, fair-housing, or investment advice.

Do not put secrets into prompts or untrusted documents unless the configured provider and workflow explicitly require that data.

## Automated verification

The repository includes a self-host smoke test that builds the image, boots the Docker Compose stack with no private `.env`, checks database health and migration state, restarts the app, and verifies migration idempotence.

GitHub Actions runs with read-only repository permissions and should not persist checkout credentials. Third-party Actions are pinned to immutable commits in the hardened workflow.

## Good-faith testing

Please avoid:

- denial-of-service or high-volume testing against deployments you do not own
- attempting to access another user's email, calendar, database, or stored connector tokens
- automated abuse of county/public endpoints through LOT
- publishing credentials or sensitive exploit details
- social engineering of property owners, vendors, users, or infrastructure providers

## Legal and financial boundary

LOT produces research and analytical outputs. Creative-finance scenarios can involve state-specific law, licensing, lender restrictions, due-on-sale clauses, disclosures, title, tax, fair-housing, and other legal obligations.

A software-generated financing structure is not legal or financial advice and should not be treated as permission to execute a transaction.

## License

Security research does not change the software license. Use and redistribution of the source remain governed by the repository's MIT License.
