# Security

## Code

- Validate all input at trust boundaries with a schema. Everything from the network, files, environment, or users is untrusted.
- Parameterized queries only. Never build SQL, shell commands, or HTML by string concatenation.
- Encode output for its context (HTML, URL, shell). Never render untrusted text as markup.
- Least privilege for every credential, token, and service account.
- Fail closed: deny on missing or ambiguous authorization.
- Use vetted libraries for cryptography, authentication, and password hashing. Never implement your own.
- Secrets come from the environment or a secret manager, never from source.

## Supply Chain

- Every dependency is pinned through a lockfile and installed with frozen-lockfile mode in CI.
- Dependency updates wait a cooldown period after publication. Most malicious publishes are caught and yanked within days.
- Dependency install scripts are denied by default and allowed one package at a time.
- GitHub Actions are pinned by full commit SHA, with the version in a trailing comment. Dependabot keeps the pins current.
- Workflows declare least-privilege `permissions` and never pass untrusted input (PR titles, branch names) into `run:` scripts through `${{ }}` expressions. `zizmor` checks this in CI.
- `gitleaks` scans for secrets in the pre-commit hook and in CI.
- A dependency vulnerability scanner runs in CI.

## Design

Anything touching authentication, authorization, or data access gets a threat-modeling section in its design doc: assets, entry points, trust boundaries, and mitigations.

## Reporting

`SECURITY.md` says how to report a vulnerability privately.
