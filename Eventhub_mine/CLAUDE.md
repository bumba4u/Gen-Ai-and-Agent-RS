# CLAUDE.md

This file  Claude Code (claudprovides guidance toe.ai/code) when working with code in this repository.

## Project Overview

EventHub is a full-stack event ticket booking platform: Next.js 14 (App Router) frontend, Express.js backend, Prisma ORM over MySQL. Users sign up, browse events, book tickets, and manage bookings; an admin UI manages events/bookings. This is a QA-training reference app (see `tests/`), so business rules are intentionally quirky (FIFO limits, sandbox isolation) — do not "fix" them without checking `.claude/skills/eventhub-domain/business-rules.md` first, since tests assert on this exact behavior.

## Commands

Run from repo root unless noted.

```bash
npm run setup      # install deps in both backend/ and frontend/
npm run dev        # run backend (nodemon, :3001) + frontend (next dev, :3000) concurrently
npm run db:push    # push Prisma schema to DB, non-interactive
npm run migrate    # prisma migrate dev — interactive, creates migration files, needs a real terminal
npm run seed       # seed 10 sample events (5 categories x 5 Indian cities)
npm run build      # next build (frontend only)
npm run lint       # next lint (frontend only; backend has no linter)
```

Testing (Playwright, root-level):
```bash
npm test                    # npx playwright test — runs everything in tests/
npm run test:ui             # Playwright UI mode
npm run test:report         # show last HTML report
npx playwright test tests/booking-management.spec.js   # single file
npx playwright test -g "TC-001"                          # single test by title
```

**There is no `playwright.config.*` at repo root.** Tests run with Playwright defaults (Chromium, no configured `baseURL`), and `tests/*.spec.js` hardcode a full `BASE_URL` constant at the top of the file instead of relying on a base URL. The current spec points at a deployed instance (`https://eventhub.rahulshettyacademy.com`), not `localhost:3000` — check/update `BASE_URL` before assuming tests exercise your local `npm run dev` servers. `.claude/skills/playwright-best-practices` documents a config with `baseURL: http://localhost:3000`; that config does not currently exist in this repo (only inside a stale worktree under `Old.claude/worktrees/`).

Backend-only sanity checks used in CI (no DB needed): `node --check server.js`, `node --check app.js`, `npx prisma validate`, `npx prisma format`, `npx prisma generate` (all run from `backend/`).

## Environment Setup

- `backend/.env` — `DATABASE_URL`, `PORT` (3001), `CORS_ORIGIN`, `JWT_SECRET`, `SHOW_EXPLORE_LINKS` (feature flag exposed via `GET /api/config`)
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL` (points at `http://localhost:3001/api`)
- MySQL 8+ required; DB name `eventhub`, charset `utf8mb4`

## Architecture

### Backend — layered, request flows one direction

`routes/` → `controllers/` → `services/` → `repositories/` → Prisma. Routes carry full Swagger JSDoc (served at `/api/docs`). Controllers are thin HTTP adapters; **all business logic and validation lives in `services/`**; `repositories/` do pure Prisma calls with no business rules. Domain errors (`NotFoundError`, `InsufficientSeatsError`, `ValidationError`, `ForbiddenError` in `src/utils/errors.js`) are thrown from services and mapped to HTTP status codes in the single global `errorHandler` middleware (`src/middleware/errorHandler.js`), which also maps known Prisma error codes (P2002/P2025/P2003). Auth is JWT-based (`authMiddleware.js` reads `Bearer` token, 7-day expiry, `bcryptjs` for password hashing) — `authService.js` / `authController.js` / `authRoutes.js` / `userRepository.js` are not yet reflected in `README.md`, so don't rely on the README for the auth story.

Booking creation/cancellation is transactional in `bookingService.js`: seat counts on `Event` are decremented/restored atomically alongside the `Booking` row.

### Frontend — App Router + React Query, with a live TS migration

`app/` (routes) → `components/` (presentational) → `lib/hooks/` (React Query hooks: `useEvents`, `useBookings`, `useAuth`) → `lib/api/` (HTTP calls) → `lib/api/client.ts` (Axios instance). `AuthGuard` (`components/auth/AuthGuard.tsx`) wraps the app layout and redirects unauthenticated users to `/login` for any route not in its `PUBLIC_PATHS` allowlist.

**`lib/api/` currently has duplicate old/new implementations** — `client.js`/`eventsApi.js`/`bookingsApi.js` (plain JS) alongside `client.ts`/`events.ts`/`bookings.ts` (TypeScript). Only the `.ts` versions are wired up (`lib/api/index.ts` re-exports from `./events`, `./bookings`, `./client`). Treat the `.js` versions in that directory as dead/legacy unless you confirm otherwise — don't edit them expecting effect, and don't assume the TS versions are the ones with `authApi.js`, which is still plain JS and used directly (not re-exported via `index.ts`).

Components mix `.jsx` and `.tsx` file extensions inconsistently across the same directories — this is pre-existing, not a build error.

### Data model (`backend/prisma/schema.prisma`)

`User` (1) —< `Event` (nullable `userId`; null = seeded/static event) and `User` (1) —< `Booking`. Key non-obvious business rules (full detail in `.claude/skills/eventhub-domain/business-rules.md`):

- **FIFO pruning**: max 6 user-created events and max 9 bookings per user — the oldest is auto-deleted when the limit is exceeded. Static (seeded) events don't count toward the event limit and can't be edited/deleted.
- **Booking reference**: `[EVENT_TITLE_FIRST_LETTER]-[6_RANDOM_ALPHANUMERIC]`, e.g. "Tech Summit" → `T-A3B2C1`. This is asserted directly in tests — don't change the generation scheme without updating `tests/`.
- **Per-user seat math**: static events use the `availableSeats` DB column directly; dynamic events compute availability as `totalSeats - sum(this user's booking quantities)`, which deliberately lets the same user "double-book" the same event across the sandbox.
- **Refund eligibility is frontend-only** (no backend endpoint): quantity 1 → refundable, quantity > 1 → not, shown after a fixed 4-second spinner.
- Cross-user access to another user's booking returns `403 Forbidden`, not `404`.

### Domain knowledge skills

`.claude/skills/eventhub-domain/` and `.claude/skills/playwright-best-practices/` are the source of truth for business rules, API reference, UI `data-testid` selectors, user flows/test data, and test-writing conventions (locator priority, POM structure, no `waitForTimeout`, etc.). Load the relevant sub-file before writing tests, reviewing code, or answering questions about how EventHub is supposed to behave — several rules (FIFO limits, sandbox banners, refund logic) are not discoverable just by reading `backend/` or `frontend/` source.

Four additional slash-command skills form a QA pipeline (each is `disable-model-invocation: true`, i.e. invoked explicitly, not auto-loaded): `/create-scenarios` generates functional test scenarios into `docs/test-scenarios.md`, `/test-strategy` assigns each scenario a test-pyramid layer (Unit/API/Component/E2E), `/generate-tests` writes and self-heals Playwright specs against a real browser, and `/review-tests` reviews spec files against `playwright-best-practices`. Use this pipeline order when asked to build out test coverage rather than writing specs ad hoc.

### CI (`.github/workflows/ci.yml`)

Three jobs on every PR to `main`: `backend-checks` (syntax check, `prisma validate`/`format`/`generate` — no DB), `schema-drift` (SSHes into the production server and runs a read-only `prisma migrate diff` against the PR's schema — depends on `backend-checks`), and `frontend-checks` (`tsc --noEmit` + `next build`). `ci.yml` is also invoked by `deploy.yml` as a pre-deploy gate via `workflow_call`.
