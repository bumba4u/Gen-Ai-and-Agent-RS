# Test Strategy: Booking Scenarios

Scope: the booking-domain subset of `docs/test-scenarios.md` — booking creation, viewing, cancellation, clear-all, refund-eligibility check, booking-reference generation, FIFO booking pruning, per-user seat math, cross-user booking security, and admin booking management. 65 of the 133 scenarios in that document fall in scope (event browsing/filtering, event CRUD, and auth-only scenarios are out of scope for this pass).

Sources consulted: `docs/test-scenarios.md`; `.claude/skills/eventhub-domain/{business-rules.md,api-reference.md}`; `.claude/skills/playwright-best-practices`; `backend/src/services/bookingService.js`; `backend/src/controllers/bookingController.js`; `backend/src/routes/bookingRoutes.js`; `backend/src/repositories/bookingRepository.js`; `backend/src/validators/bookingValidator.js`; `backend/src/middleware/{authMiddleware,errorHandler}.js`; `frontend/app/events/[id]/page.tsx`; `frontend/app/bookings/page.tsx`; `frontend/app/bookings/[id]/page.tsx`; `frontend/app/admin/bookings/page.tsx`; `tests/booking-management.spec.js`.

---

## Tooling Reality Check (read this before the tables)

This repo has **exactly one test runner configured: Playwright, at the repo root** (`npm test` → `npx playwright test`), driving a real Chromium browser against a deployed instance (`tests/booking-management.spec.js` hardcodes `BASE_URL = 'https://eventhub.rahulshettyacademy.com'`). There is:
- **No backend unit-test framework** — `backend/package.json` has no Jest/Mocha/Vitest/`node --test` script, only `nodemon`/`prisma` devDependencies.
- **No dedicated API-test setup** — no supertest, no separate API test directory.

So "Unit" and "API" as *layers* exist in this strategy as design intent, but only "API" is practically executable today, and only via Playwright's `request` fixture (`await request.post(`${BASE_URL}/api/bookings`, {...})`) calling the backend directly without opening a page — this is still a legitimate, fast, non-UI layer and is what "API" means everywhere below. "Unit" scenarios (pure, I/O-free logic like `randomRef()`'s string shape or `price × quantity` arithmetic) are flagged **Unit (aspirational)** — they are correctness-critical and cheap to isolate, but doing so today requires introducing a real unit runner (recommended in Findings below). Until then they are pragmatically covered by the API layer as a fallback, at higher cost than they should be.

"Component" below means a Playwright test that mounts/exercises a single page or component in isolation via route mocking (`page.route(...)` to stub API responses) rather than driving a full multi-page journey — still executed by `npx playwright test`, just scoped narrowly and fast, per `.claude/skills/playwright-best-practices`.

---

## Distribution

| Layer | Count | % | Focus | Relative Cost |
|---|---|---|---|---|
| Unit (aspirational) | 4 | 6% | Pure logic: booking-ref format/collision-retry, `totalPrice` arithmetic | ms — needs a unit runner to realize |
| API | 34 | 52% | Validator rules, FIFO pruning, per-user seat math, authorization/cross-user checks, error-code contracts | ms–sec, no browser |
| Component | 18 | 28% | Booking-form UI state, refund state machine, admin table conditional rendering, loading/empty/error blocks | sec, single page, mocked API |
| E2E | 9 | 14% | Full booking journey, native browser dialogs, session/cross-page flows | sec–min, real browser + real backend |

**Pragmatic distribution under current tooling** (Unit folded into API since no unit runner exists yet): API 38 (58%), Component 18 (28%), E2E 9 (14%). Still a healthy pyramid — wide base, narrow top — even without a true unit layer.

---

## Layer Assignments

### Happy Path

| TC | Title | Layer | Source | Rationale |
|---|---|---|---|---|
| TC-013 | Book single ticket, static event | **E2E** | `POST /api/bookings` via `bookingController.createBooking` → UI at `events/[id]/page.tsx` | Critical revenue-path journey spanning 2 pages (list→detail) plus form fill; needs real browser to validate the confirmation card replaces the form in place |
| TC-014 | Book multiple tickets, dynamic event | **E2E** | same as above | Same journey, quantity stepper interaction is a real UI control |
| TC-015 | View bookings list | **E2E** | `GET /api/bookings` → `bookings/page.tsx` | Folded into the same spec file as TC-013/019 as a chained assertion rather than a standalone test — avoids re-login/re-booking cost |
| TC-016 | View booking detail | **E2E** | `GET /api/bookings/:id` → `bookings/[id]/page.tsx` | Same rationale — chain onto TC-013's booking rather than a fresh journey |
| TC-017 | Refund check, qty=1 | **Component** | `RefundEligibility` fn, `bookings/[id]/page.tsx` | Pushed down from E2E: the 4s spinner→result behavior is pure client state keyed only on `quantity` prop — mock `GET /api/bookings/:id` to return `quantity:1` and test in isolation. See TC-505/TC-114 (same mechanism, duplicate coverage would be waste) |
| TC-018 | Refund check, qty>1 | **Component** | same | Same as TC-017 with `quantity:3` |
| TC-019 | Cancel a booking | **E2E** | `DELETE /api/bookings/:id` → `ConfirmDialog` in `bookings/[id]/page.tsx` | Requires real browser: styled `ConfirmDialog` modal interaction, toast, and client-side navigation back to `/bookings` |
| TC-020 | Clear all bookings | **E2E** | `DELETE /api/bookings` → `bookings/page.tsx` `handleClearAll` | Requires a **native** `window.confirm()` — only observable/controllable via Playwright's `page.on('dialog', ...)` in a real browser (see TC-503, same test) |
| TC-021 | Get booking by ref (API) | **API** | `GET /api/bookings/ref/:ref` → `bookingController.getBookingByRef` | Pure request/response contract check, no UI involved |
| TC-026 | Admin views booking via modal | **Component** | `admin/bookings/page.tsx` `BookingModal` | Modal renders from already-fetched row data (no network call) — a single-page Component test with a fixture row is sufficient and avoids a full admin-table E2E setup |
| TC-027 | Admin cancels confirmed booking | **E2E** | `DELETE /api/bookings/:id` → `admin/bookings/page.tsx` `confirmCancel` | Needs to verify seat-restoration is reflected across a second page (event detail) — genuinely full-stack |
| TC-028 | Filter admin bookings by status | **Component** | `admin/bookings/page.tsx` `STATUS_OPTIONS`/`Select` | Pure UI filter-state behavior; mock `GET /api/bookings?status=...` responses, assert table re-renders — no need for real cancelled/confirmed data setup via E2E |

### Business Rules

| TC | Title | Layer | Source | Rationale |
|---|---|---|---|---|
| TC-106 | Ref first letter matches title | **Unit (aspirational)** | `randomRef(eventTitle)` in `bookingService.js` | Pure string transform, zero I/O — the textbook unit-test case. Currently the only spec covering this (`booking-management.spec.js` "TC-102") does it via a full login→browse→book E2E flow just to read a 6-char suffix — classic "pure logic tested at E2E" anti-pattern (see Findings) |
| TC-107 | Ref uniqueness via collision retry | **Unit (aspirational)** | `generateUniqueRef()` in `bookingService.js` | Needs the repository's `findByRef` mocked to force a collision on attempt 1 — impossible to reliably trigger via a real API/E2E call, must be isolated |
| TC-108 | Per-user seat math, cross-user double-booking | **API** | `bookingService.createBooking` seat check + `eventService.withPersonalSeats` | Requires two real user accounts and DB state (two bookings against one event) — genuine integration, not pure logic; no UI involvement needed to prove the number |
| TC-109 | Static event shared seat pool | **API** | same seat-check path, `availableSeats` DB column | Same reasoning as TC-108 |
| TC-110 | Booking FIFO pruning at 10th booking | **API** | `bookingService.createBooking` (`countUserBookings`, `findOldestUserBookingExcludingEvent`) | Requires building up 9 rows of real DB state — cheapest and fastest via direct API calls in a loop, no reason to drive this through the UI 9 times |
| TC-111 | FIFO same-event fallback burns a seat | **API** | `bookingService.createBooking` `sameEventFallback` branch, `eventRepository.decrementSeats` | Same as TC-110, plus needs to assert on the event's `availableSeats` DB value directly after — an API-only assertion; **flag as P1 for defense-in-depth** since this rule is undocumented in `business-rules.md` and easy to regress silently |
| TC-112 | Cancel frees seats immediately | **API** | `bookingService.cancelBooking` → re-check via `GET /api/events/:id` | Two chained API calls prove the rule without any UI |
| TC-113 | totalPrice = price × quantity, decimal-safe | **Unit (aspirational)** | `parseFloat(event.price) * data.quantity` in `bookingService.createBooking` | Pure arithmetic — floating-point rounding concerns are exactly what unit tests are for; testing this via a live booking call works but is 100x more expensive than it needs to be for what's ultimately a one-line multiplication |
| TC-114 | Refund boundary qty=1 vs 2 | **Component** | `RefundEligibility` fn | Same mechanism as TC-017/018 — one Component test parametrized over `[1, 2, 3]` covers this plus TC-408's pluralization check in a single spec |
| TC-115 | Refund check has no backend persistence | **Component** | `RefundEligibility` fn (no `fetch`/mutation call) | Assert via Playwright's `page.route` call-count / network-log that no new request fires when "Check eligibility" is clicked twice — no real backend needed to prove an absence of a call |

### Security

| TC | Title | Layer | Source | Rationale |
|---|---|---|---|---|
| TC-200 | Cross-user GET booking → 403 | **API** | `bookingService.getBookingById` `ForbiddenError` | Authorization checks are a request/response contract; driving this through the browser UI adds cost (second login, page loads) with zero added signal over two `request.get()` calls with different bearer tokens |
| TC-201 | Cross-user GET by ref → 403 | **API** | `bookingService.getBookingByRef` | Same reasoning |
| TC-202 | Cross-user DELETE → 404 not 403 | **API** | `bookingRepository.findById(id, userId)` scoping | This is specifically about the exact status code returned — only observable/assertable precisely at the API layer; also the most valuable regression guard in the whole suite since it contradicts `api-reference.md`'s documented behavior |
| TC-203 | Missing auth token → 401 | **API** | `authMiddleware.js` | Trivial to hit directly, no session/browser needed |
| TC-204 | Malformed/expired JWT → 401 | **API** | `authMiddleware.js` `jwt.verify` catch | Same |
| TC-205 | Stale session mid-page, no auto-redirect | **E2E** | `AuthGuard.tsx` / `lib/api/client.ts` (absence of interceptor) | This is specifically about *browser* behavior after a token goes stale mid-session (no redirect happens) — can only be observed with a real page already mounted, not a bare API call |
| TC-206 | Client tampering with qty/price bypassed server-side | **API** | `bookingService.createBooking` (server-computed `totalPrice`), `bookingValidator.js` qty max | Directly craft the malicious payload via `request.post` — this is the whole point of the test, going through the UI would just prevent the tampering rather than test the server's defense |
| TC-207 | IDOR — enumerate booking ids | **API** | `bookingController.getBookingById` + `ForbiddenError` mapping | Loop of `request.get()` calls across an id range; would be absurdly slow and flaky via UI navigation |
| TC-208 | Booking another user's dynamic event via crafted eventId | **API** | `bookingService.createBooking` (no ownership check on create) | Same — this is proving an *absence* of an ownership check, a pure request/response assertion |

### Negative / Error Scenarios

| TC | Title | Layer | Source | Rationale |
|---|---|---|---|---|
| TC-300 | customerName < 2 chars | **API** | `bookingValidator.js` `.isLength({min:2})` | Every TC-300–312 row is a 1:1 mapping to a single `express-validator` rule — these are exactly the "input validation tested at E2E" anti-pattern the skill warns against if done via UI form-fill; hit the endpoint directly |
| TC-301 | Invalid email format | **API** | `bookingValidator.js` `.isEmail()` | ″ |
| TC-302 | Phone fails char whitelist | **API** | `bookingValidator.js` phone regex | ″ |
| TC-303 | Phone < 10 chars | **API** | `bookingValidator.js` `.isLength({min:10})` | ″ |
| TC-304 | Quantity = 0 | **API** | `bookingValidator.js` `.isInt({min:1,max:10})` | ″ |
| TC-305 | Quantity = 11 | **API** | same | ″ |
| TC-306 | Non-integer/negative eventId | **API** | `bookingValidator.js` eventId rule | ″ |
| TC-307 | Nonexistent eventId → 404 | **API** | `bookingService.createBooking` `NotFoundError` | Contract check, no UI needed |
| TC-308 | Insufficient seats → 400 | **API** | `bookingService.createBooking` `InsufficientSeatsError` | Requires precise DB seat state setup — cheaper and more reliable to arrange via direct API calls than via the UI |
| TC-309 | Sold-out event blocks UI | **Component** | `events/[id]/page.tsx` `soldOut` disabled state | This one genuinely IS a UI-state assertion (button disabled + relabeled) rather than a request rejection — the only negative-category item that belongs above API. Mock the event fixture with `availableSeats: 0` rather than actually depleting a real event via 10 bookings first |
| TC-310 | Missing required fields | **API** | `bookingValidator.js` `.notEmpty()` rules | Anti-pattern to test via UI form (browser `required` semantics would interfere); one API test looping over each omitted field |
| TC-311 | Cancel nonexistent booking → 404 | **API** | `errorHandler.js` P2025 mapping | Contract check |
| TC-312 | Clear-all with zero bookings is no-op | **API** | `bookingService.clearAllBookings` | Trivial, no UI needed |
| TC-313 | Concurrent bookings don't oversell last seat | **API** | transactional creation in `bookingService.js` | Needs two truly concurrent requests (`Promise.all` of two `request.post()` calls) — a real browser adds nothing and would make the race harder to control precisely |

### Edge Cases

| TC | Title | Layer | Source | Rationale |
|---|---|---|---|---|
| TC-400 | Book exactly qty=10 | **Component** (UI stepper) + **API** (contract) | `events/[id]/page.tsx` stepper; `bookingValidator.js` max 10 | Split: "the `+` button disables at 10" is Component; "the backend accepts exactly 10" is already proven by TC-305's boundary-adjacent coverage plus one API assertion here — avoid a third E2E test for a boundary already covered twice below it |
| TC-401 | Stepper capped at min(10, availableSeats) | **Component** | `events/[id]/page.tsx` `maxQty = Math.min(10, event.availableSeats)` | Pure UI-state logic driven by a mocked event fixture (`availableSeats: 4`) — no real booking history needs to be built up |
| TC-402 | 9→10 booking FIFO boundary | **API** | `bookingService.createBooking` | Same reasoning as TC-110 (this is its boundary-precision variant) — build 9 real bookings via loop, assert only #1 is gone after the 10th |
| TC-403 | customerName exactly 2 chars (boundary) | **API** | `bookingValidator.js` | Boundary variant of TC-300, same validator rule |
| TC-404 | customerPhone exactly 10 chars (boundary) | **API** | `bookingValidator.js` | Boundary variant of TC-303 |
| TC-405 | Phone raw-length vs digit-count validator divergence | **API** | `bookingValidator.js` vs frontend digit-count logic | This is specifically a backend-bypass concern (frontend stricter than backend) — must be proven via direct API call bypassing the frontend entirely, by definition can't be an E2E/Component test |
| TC-406 | Email normalization (Gmail dot/plus) | **API** | `bookingValidator.js` `.normalizeEmail()` | Assert on the stored/returned `customerEmail` in the API response |
| TC-407 | Ref prefix for digit/symbol-leading titles | **API** | `randomRef()` via a real `createBooking` call | Ideally Unit (see TC-106) but requires a real event with a crafted title, so bundling into an API-level booking test is the practical home; if TC-106 gets a true unit test with a mocked title, this becomes redundant and can be dropped |
| TC-408 | Refund pluralization at qty=2 | **Component** | `RefundEligibility` fn | Parametrize alongside TC-114 (same test, extra assertion on the exact string) |
| TC-409 | Free event (price=0) booking | **API** | `bookingService.createBooking` totalPrice calc | Simple arithmetic edge, no UI needed |
| TC-410 | Ref collision fallback shape after 10 retries | **Unit (aspirational)** | `generateUniqueRef()` fallback branch in `bookingService.js` | Same as TC-107 — requires mocking `findByRef` to collide 10 times in a row, which is only practical with dependency injection at the unit level, not reproducible via real API calls |

### UI State

| TC | Title | Layer | Source | Rationale |
|---|---|---|---|---|
| TC-500 | Bookings list loading skeletons | **Component** | `bookings/page.tsx` (5 `BookingCardSkeleton`) | Delay a mocked `GET /api/bookings` response via `page.route` and assert skeleton count — no real backend latency needed or wanted (flaky if timing-dependent on a real network) |
| TC-501 | Bookings list error + Retry | **Component** | `bookings/page.tsx` `EmptyState` + `refetch()` | Mock a 500/network failure via `page.route`, assert Retry re-fires the request |
| TC-502 | Bookings list empty state | **Component** | `bookings/page.tsx` | Mock `data: []` response |
| TC-503 | Clear-all uses native `confirm()`, not styled modal | **E2E** | `bookings/page.tsx` `handleClearAll` | Native browser dialogs can only be intercepted in a real browser context (`page.on('dialog', ...)`) — cannot be simulated via route mocking. Same physical test as TC-020; list once here as the "must be E2E, here's why" anchor |
| TC-504 | 403 "Access Denied" vs generic 404 copy | **Component** | `bookings/[id]/page.tsx` `isError`/`is403` branch | Mock `GET /api/bookings/:id` to return 403 once and 404 once, assert the two different copy strings render — proves the UI logic without needing two real user accounts (that real-auth proof is TC-200/201's job, already at API) |
| TC-505 | Refund idle→checking→result state machine | **Component** | `RefundEligibility` fn | Assert `#check-refund-btn` → `#refund-spinner` → `#refund-result` sequencing with a mocked booking fixture; consolidate with TC-017/018/114/408 into one parametrized spec file rather than 5 separate tests |
| TC-507 | Admin bookings distinct loading/empty/error blocks | **Component** | `admin/bookings/page.tsx` | Same mocking approach as TC-500/501/502, applied to the admin table |
| TC-508 | Admin "Cancel" only for confirmed rows | **Component** | `admin/bookings/page.tsx` row rendering | Mock a fixture with mixed `status` values, assert conditional button rendering — no real cancelled-booking data needs to exist |
| TC-509 | Confirmation card replaces form in place | **Component** | `events/[id]/page.tsx` `BookingForm`/`confirmed` state | Mock `POST /api/bookings` success, assert the form is replaced without a `page.goto`/navigation event firing — this specific "no navigation happened" assertion is actually easier to prove precisely at Component level than embedded inside a longer E2E journey |

---

## Decision Rationale for Contested Assignments

**Refund eligibility (TC-017, 018, 114, 115, 408, 505) — E2E in the existing scenario doc's "Suggested Layer" column, downgraded to Component here.** The existing `docs/test-scenarios.md` marks most of these E2E because the user-facing flow starts with "open the booking detail page." But the mechanism under test — a `setTimeout(4000)` state machine keyed only on a `quantity` number — has zero dependency on how that quantity got there. Driving it via a real login + real booking + real 4-second wait, five separate times (once per TC), costs ~20+ seconds of real wall-clock wait per full run for logic that a single mocked-fixture Component spec proves in the same wall-clock time as everything else combined. Keep **one** E2E assertion that the refund button is reachable from a real booking (folded into TC-016), and push the state-machine correctness itself down.

**Security scenarios (TC-200–208) — kept out of E2E entirely.** It would be tempting to write these as "login as User A, log out, log in as User B, navigate to the URL, assert Access Denied" — and that is exactly the "API error codes tested at E2E" anti-pattern the strategy is meant to catch. The authorization logic lives entirely in `bookingService.js`/`errorHandler.js` and is fully exercised by two bearer tokens and an HTTP client. The *one* exception is TC-205, which is about browser session behavior (no redirect happens), not about the status code itself — that can't be observed without a mounted page.

**FIFO pruning (TC-110, 111, 402) — API, not E2E, despite needing "9 bookings first."** Building 9 bookings via 9 real UI journeys would make this the slowest test in the whole suite for a rule that is 100% backend logic. A `for` loop of 9 `request.post()` calls is both faster and a more precise probe of the exact rule (which booking got deleted), since UI card ordering could introduce false negatives from rendering/sorting quirks unrelated to the rule itself.

**TC-504 (403 vs 404 copy) — Component via route mocking, not a repeat of the real cross-user TC-200/201.** Two different things are being proven: TC-200/201 prove the *backend* returns the right status code for a real unauthorized request (API layer, real auth). TC-504 proves the *frontend* renders different copy for those two status codes (Component layer, mocked responses) — testing it with two real accounts again would be redundant coverage of the backend contract already nailed down elsewhere, not additional signal about the UI.

**TC-111 gets defense-in-depth despite being a single scenario.** Every other rule here gets one primary layer, but TC-111 (the same-event FIFO fallback that burns a seat) is the single most likely rule to silently regress, because it's completely undocumented outside the code itself (not in `business-rules.md`, not in any existing test). Recommend this specific scenario also gets a comment/annotation in the generated spec pointing back to `bookingService.js`'s `sameEventFallback` branch so a future reader understands why the test exists.

---

## Anti-Patterns Found in Existing Tests

`tests/booking-management.spec.js` is the **only** test file in the repo, and it illustrates the exact anti-pattern this strategy is meant to correct:

1. **100% E2E, 0% API, 0% Unit ("ice cream cone," inverted pyramid).** All 5 existing tests drive a real browser through login → navigate → book, even for scenarios that don't need it. There is no `request`-fixture usage anywhere, despite Playwright supporting it natively — meaning every validator rule, every FIFO rule, and every authorization rule in the backend currently has **zero** test coverage of any kind, since the one file that exists only covers 5 happy-path/UI scenarios.
2. **Pure logic tested at E2E**: `TC-102: booking reference starts with first letter of event title` (in the existing spec) performs a full login + browse + book flow just to regex-match a 6-character suffix. This is precisely what TC-106 above corrects — the underlying rule (`randomRef()`) is one line of pure string logic.
3. **Stale TC-ID references**: the existing spec's inline comments (`TC-001`, `TC-002`, `TC-003 + TC-506`, `TC-102`) refer to a prior, differently-numbered version of `docs/test-scenarios.md`. After this strategy renumbered the scenario doc to cover the full app, none of those comment references line up with current TC IDs any more. When `/generate-tests` regenerates or extends this file, update the inline `// TC-XXX` comments to match the current numbering above (e.g. old `TC-102` → new `TC-106`), or drop the numeric references in favor of descriptive names to avoid this drift recurring.
4. **No critical-rule defense-in-depth**: none of FIFO pruning, per-user seat math, or cross-user 403/404 behavior is tested anywhere today, at any layer — these are the highest-priority gaps to fill first (see Priorities below).

---

## Priorities for `/generate-tests`

If not implementing all 65 scenarios at once, generate in this order:

1. **P0 API**: TC-108, 109, 110, 111, 202 (undocumented/contradicts-docs behavior — highest regression value, currently zero coverage)
2. **P0 API**: TC-200, 201, 203, 204, 206, 207, 208 (security — currently zero coverage)
3. **P0/P1 API**: TC-300–313 (validator contract — currently zero coverage, cheap to write)
4. **Component**: consolidate TC-017/018/114/115/408/505 into one parametrized refund spec; TC-500–502/507/508/509
5. **E2E**: keep the 9 identified above lean — TC-013/014/015/016 as one chained journey, TC-019, TC-020(+503), TC-027, TC-205
6. **Unit (aspirational)**: flag TC-106/107/113/410 to the user as needing a backend unit-test runner decision before they can be implemented as intended; do not silently implement them as API tests without noting the tradeoff
