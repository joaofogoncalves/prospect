# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Instead, report privately via GitHub's
[**Report a vulnerability**](https://github.com/joaofogoncalves/project_intake/security/advisories/new)
flow (Security → Advisories), which opens a private channel with the maintainer.

When reporting, please include:

- a description of the issue and its impact,
- steps to reproduce (a minimal proof-of-concept helps),
- affected versions / commit, and
- any suggested remediation.

You can expect an initial acknowledgement within **5 business days**. We'll keep
you updated on progress and coordinate a disclosure timeline once a fix is ready.

## Supported versions

This is an actively developed project; only the latest `main` is supported.
Security fixes land on `main` and are not back-ported.

## Scope notes

- Secrets (`OPENAI_API_KEY`, `JWT_SECRET`) live only in the root `.env`, which is
  gitignored. Never commit real secrets — push protection is enabled on this repo.
- Intake data is user-scoped and protected by JWT auth; report any access-control
  bypass through the private channel above.
