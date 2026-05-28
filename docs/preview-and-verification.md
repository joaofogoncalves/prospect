# Live preview & browser verification

This repo is set up so that **any session (human or Claude) can run a live dev
server and verify the UI in a real browser against the specs in [`api.md`](./api.md)
and [`architecture.md`](./architecture.md)** while the app is being built.

Two pieces:

1. **Live dev servers** — Vite (frontend) + Fastify (backend) with hot reload, so
   changes appear immediately at <http://localhost:5173>.
2. **Playwright MCP** — a browser Claude can drive to navigate, read the page,
   capture screenshots, and check the console.

## 1. Start the live servers

```bash
npm install          # first time only — also installs git hooks
npm run db:migrate    # first time only — create/upgrade the SQLite db
npm run dev           # backend :3000 + frontend :5173, both with hot reload
```

| Service | URL | Live reload |
| --- | --- | --- |
| Frontend (Vite) | <http://localhost:5173> | HMR — edits show instantly |
| Backend (Fastify, `tsx watch`) | <http://localhost:3000> | restarts on save |

**Open <http://localhost:5173> in a browser to watch the UI being built live.**

### Running them in the background (so a session can keep working)

```bash
npm run dev:backend  > /tmp/pi_backend.log  2>&1 &
npm run dev:frontend > /tmp/pi_frontend.log 2>&1 &
```

Useful checks:

```bash
# Are they up?
lsof -iTCP:3000 -iTCP:5173 -sTCP:LISTEN -P

# Tail logs
tail -f /tmp/pi_backend.log /tmp/pi_frontend.log

# API smoke test
curl -s http://localhost:3000/health           # -> {"status":"ok"}
curl -s -o /dev/null -w "%{http_code}\n" \
     http://localhost:3000/api/projects          # -> 401 (auth-protected)
```

If the backend errors on `DATABASE_URL`, run migrations with the root `.env`
loaded the way the package scripts do:

```bash
cd backend && npx dotenv -e ../.env -- prisma migrate deploy
```

## 2. Verify the UI with Playwright

The **`playwright` plugin** (installed via `/plugin`) provides a browser Claude
controls through MCP tools named `mcp__plugin_playwright_playwright__browser_*`.
If they aren't available in a session, run `/reload-plugins`.

Core tools:

| Tool | Use |
| --- | --- |
| `browser_navigate` | Go to a URL (e.g. `http://localhost:5173`) |
| `browser_snapshot` | Accessibility tree — **use this to decide what to click/type** |
| `browser_take_screenshot` | PNG of the page (read it back to look at the UI) |
| `browser_console_messages` | Read console errors/warnings |
| `browser_click` / `browser_type` / `browser_fill_form` | Drive interactions |
| `browser_network_requests` | Inspect API calls the page made |

### Typical verification loop

1. `browser_navigate` to the screen under test.
2. `browser_snapshot` to read the structure; `browser_console_messages` (level
   `error`) to catch runtime errors.
3. Drive the flow (`browser_type`, `browser_click`, `browser_fill_form`).
4. `browser_take_screenshot`, then **Read the PNG** to confirm it looks right.
5. Compare behavior against [`api.md`](./api.md) / [`architecture.md`](./architecture.md).

### Example: register → dashboard

```text
browser_navigate  http://localhost:5173/register
browser_fill_form email=you@example.com, password=at-least-8-chars, name=You
browser_click     "Create account"
browser_snapshot                       # expect to land on the dashboard
browser_console_messages level=error   # expect none
```

### Known-good baseline (2026-05-28)

- `/` redirects to `/login` (auth routing).
- Login renders: Email + Password fields, **Sign in**, **Create one** → `/register`.
- `/health` → `200`; `/api/projects` → `401` when unauthenticated.
- The only console error is a missing `favicon.ico` (404) — cosmetic.

## Artifacts & git

Playwright writes screenshots, snapshots, traces, and console logs to
**`.playwright-mcp/`**, which is **gitignored** (along with `test-results/`,
`playwright-report/`, and `*-snapshot.png`). Verification output never gets
committed and never trips the docs-sync hook. Use relative filenames when saving
screenshots so they land in that directory.
