# Documentation

Living documentation for **Project Intake**. Keep these pages in sync with the
code — a `post-commit` hook reminds you when source changes land without a
matching docs update (see [`.githooks/post-commit`](../.githooks/post-commit)).

| Doc | Contents |
| --- | --- |
| [architecture.md](./architecture.md) | Stack, repo layout, request flow, data model, views |
| [api.md](./api.md) | HTTP endpoints and payloads |
| [ai.md](./ai.md) | Intake AI analysis: prompt, schema, error handling |
| [development.md](./development.md) | Setup, running, scripts, environment variables |
| [testing.md](./testing.md) | Vitest component tests + Playwright e2e; how to add tests |
| [decisions.md](./decisions.md) | Decision log — the major calls and why (append on each big decision) |
| [preview-and-verification.md](./preview-and-verification.md) | Live dev servers + driving Playwright to verify the UI |

> The repo-root [`README.md`](../README.md) is the short public overview.
> [`CLAUDE.md`](../CLAUDE.md) is guidance for working in this repo with Claude Code.
