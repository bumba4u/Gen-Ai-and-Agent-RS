# Test Scenarios: EventHub (Full Application)

Scope: authentication & registration; event browsing/search/filter/pagination; event booking; booking management (view/cancel/clear/refund-check); admin event CRUD; admin booking management; cross-user sandbox isolation and security; FIFO pruning for both events and bookings.

Sourced from `.claude/skills/eventhub-domain/` (business-rules.md, user-flows.md, api-reference.md, ui-selectors.md) plus verified code inspection of: `backend/src/services/{authService,eventService,bookingService}.js`, `backend/src/validators/{eventValidator,bookingValidator}.js`, `backend/src/routes/authRoutes.js` (inline `validateAuth`), `backend/src/middleware/authMiddleware.js`, `frontend/app/{login,register}/page.tsx`, `frontend/app/events/page.tsx`, `frontend/app/events/[id]/page.tsx`, `frontend/app/bookings/page.tsx`, `frontend/app/bookings/[id]/page.tsx`, `frontend/app/admin/events/page.tsx`, `frontend/app/admin/bookings/page.tsx`, `frontend/components/events/{EventForm.jsx,EventFilters.jsx}`, `frontend/components/auth/AuthGuard.tsx`, `frontend/lib/hooks/useAuth.tsx`.

Several scenarios below capture **discovered code behavior that diverges from `.claude/skills/eventhub-domain/business-rules.md` or `api-reference.md`** — these are flagged explicitly since they're easy to miss by reading the domain skill alone.

---

## Happy Path (TC-001–TC-099)

### TC-001: Register a new account with a valid strong password
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Email not already registered
**Steps**:
1. Navigate to `/register`
2. Enter a unique email and a password satisfying all 4 rules (8+ chars, uppercase, number, symbol)
3. Confirm password matches
4. Submit
**Expected Results**: Account created, JWT stored in `localStorage` under `eventhub_token`, redirected to `/`
**Business Rule**: Registration flow (user-flows.md Flow 1)
**Suggested Layer**: E2E

### TC-002: Login with valid credentials
**Category**: Happy Path
**Priority**: P0
**Preconditions**: A registered account
**Steps**:
1. Navigate to `/login`
2. Enter correct email/password
3. Submit
**Expected Results**: JWT issued and stored; redirected to `/`
**Business Rule**: Login flow (user-flows.md Flow 1)
**Suggested Layer**: E2E

### TC-003: `GET /api/auth/me` returns identity for a valid token
**Category**: Happy Path
**Priority**: P1
**Preconditions**: A valid JWT
**Steps**:
1. Call `GET /api/auth/me` with `Authorization: Bearer <token>`
**Expected Results**: 200, `{ user: { userId, email } }`
**Business Rule**: API reference — `GET /api/auth/me`
**Suggested Layer**: API

### TC-004: Logout clears session and redirects to login
**Category**: Happy Path
**Priority**: P1
**Preconditions**: Logged-in user
**Steps**:
1. Trigger `logout()`
**Expected Results**: `eventhub_token` removed from `localStorage`; user/token state cleared; redirected to `/login`
**Business Rule**: Discovered code behavior (`useAuth.tsx`)
**Suggested Layer**: E2E

### TC-005: Session persists across a page reload
**Category**: Happy Path
**Priority**: P1
**Preconditions**: Logged-in user with a valid stored token
**Steps**:
1. Reload any protected page
**Expected Results**: `AuthGuard` shows a spinner while `getMe()` validates the stored token, then renders the page without redirecting to `/login`
**Business Rule**: Discovered code behavior (`useAuth.tsx` mount effect, `AuthGuard.tsx`)
**Suggested Layer**: E2E

### TC-006: Browse the default events list
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Logged-in user; seeded events exist
**Steps**:
1. Navigate to `/events`
**Expected Results**: Up to 12 event cards render (`limit=12`), each with title, category, city, date, price, and a "Book Now" button
**Business Rule**: Browse & filter (user-flows.md Flow 2)
**Suggested Layer**: E2E

### TC-007: Search events by keyword
**Category**: Happy Path
**Priority**: P1
**Preconditions**: Events with distinct titles/venues exist
**Steps**:
1. Type a keyword matching an event's title, description, or venue into the search box
**Expected Results**: After the 300ms debounce, the URL gains `?search=...` (page reset to 1) and only matching events render
**Business Rule**: Browse & filter (user-flows.md Flow 2); discovered debounce (`EventFilters.jsx`)
**Suggested Layer**: Component

### TC-008: Filter events by category
**Category**: Happy Path
**Priority**: P1
**Preconditions**: Events across multiple categories exist
**Steps**:
1. Select "Concert" from the category dropdown
**Expected Results**: Only Concert-category events render; URL reflects `?category=Concert`
**Business Rule**: Browse & filter (user-flows.md Flow 2)
**Suggested Layer**: Component

### TC-009: Filter events by city
**Category**: Happy Path
**Priority**: P1
**Preconditions**: Events across multiple cities exist
**Steps**:
1. Select "Mumbai" from the city dropdown
**Expected Results**: Only Mumbai events render
**Business Rule**: Browse & filter (user-flows.md Flow 2)
**Suggested Layer**: Component

### TC-010: Combine search, category, and city filters
**Category**: Happy Path
**Priority**: P2
**Preconditions**: Events with overlapping and non-overlapping attributes exist
**Steps**:
1. Apply a search term, then a category, then a city filter together
**Expected Results**: Result set matches the intersection of all three filters; "Clear filters" button appears once any filter is active
**Business Rule**: Discovered UI behavior (`EventFilters.jsx` `hasFilters`)
**Suggested Layer**: Component

### TC-011: Paginate through the events list
**Category**: Happy Path
**Priority**: P2
**Preconditions**: More than 12 events match the current filters
**Steps**:
1. Click page 2 in the pagination control
**Expected Results**: URL updates to `?page=2`; next 12 events load; page scrolls to top
**Business Rule**: Browse & filter (user-flows.md Flow 2)
**Suggested Layer**: E2E

### TC-012: "Book Now" navigates from an event card to its detail page
**Category**: Happy Path
**Priority**: P0
**Preconditions**: At least one event card visible
**Steps**:
1. Click "Book Now" (`data-testid="book-now-btn"`) on a card
**Expected Results**: Navigates to `/events/:id` showing full event details and the booking panel
**Business Rule**: Book an event (user-flows.md Flow 3)
**Suggested Layer**: E2E

### TC-013: Book a single ticket for a static (seeded) event
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Logged-in user; a static event with available seats (e.g. "Tech Conference Bangalore")
**Steps**:
1. Navigate to `/events`, click "Book Now" on the event
2. On `/events/:id`, leave quantity at 1
3. Fill customerName, customerEmail, customerPhone
4. Click "Confirm Booking"
**Expected Results**: Booking succeeds; confirmation card shows a booking reference starting with the event title's first letter (uppercase) followed by `-` and 6 alphanumeric chars (e.g. `T-8K3F9A`); `totalPrice = price x 1`; event's available seats decrement by 1
**Business Rule**: Booking reference format (business-rules.md #7); price calculation (#9)
**Suggested Layer**: E2E

### TC-014: Book multiple tickets (quantity > 1) for a dynamic (user-created) event
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Logged-in user owns a dynamic event with sufficient seats
**Steps**:
1. Navigate to the owned event's detail page
2. Increase quantity to e.g. 4 using the `+` stepper
3. Fill valid customer form fields
4. Submit booking
**Expected Results**: Booking created with `quantity=4`, `totalPrice = price x 4`; personal available seats reduce by 4 (`totalSeats - sum(this user's quantities)`)
**Business Rule**: Per-user seat availability (business-rules.md #6); price calculation (#9)
**Suggested Layer**: E2E

### TC-015: View list of all bookings
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User has 1+ bookings
**Steps**:
1. Navigate to `/bookings`
**Expected Results**: All the user's bookings are listed with event title, date, quantity, status, and reference; no other user's bookings appear
**Business Rule**: User sandbox isolation (business-rules.md #2)
**Suggested Layer**: E2E

### TC-016: View a single booking's details
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User has at least one booking
**Steps**:
1. From `/bookings`, click "View Details" on a booking
**Expected Results**: `/bookings/:id` shows full booking info (customer details, quantity, totalPrice, bookingRef, status) plus associated event details
**Business Rule**: User journey (business-rules.md #1)
**Suggested Layer**: E2E

### TC-017: Check refund eligibility for a single-ticket booking
**Category**: Happy Path
**Priority**: P1
**Preconditions**: A booking with `quantity = 1`
**Steps**:
1. Open the booking detail page
2. Click "Check Refund Eligibility" (`#check-refund-btn`)
3. Wait for the spinner (`#refund-spinner`)
**Expected Results**: After ~4 seconds, result (`#refund-result`) shows "Single-ticket bookings qualify for a full refund"
**Business Rule**: Refund eligibility (business-rules.md #8)
**Suggested Layer**: E2E

### TC-018: Check refund eligibility for a multi-ticket booking
**Category**: Happy Path
**Priority**: P1
**Preconditions**: A booking with `quantity > 1` (e.g. 3)
**Steps**:
1. Open the booking detail page
2. Click "Check Refund Eligibility"
3. Wait for the spinner
**Expected Results**: After ~4 seconds, result shows "Group bookings (3 tickets) are non-refundable"
**Business Rule**: Refund eligibility (business-rules.md #8)
**Suggested Layer**: E2E

### TC-019: Cancel a single booking
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User has a booking for a dynamic event
**Steps**:
1. From `/bookings` or booking detail page, cancel/delete the booking
**Expected Results**: Booking removed from the list; `DELETE /api/bookings/:id` returns success; the event's available seats for this user increase back by the cancelled quantity
**Business Rule**: Booking deletion frees seats (business-rules.md #4)
**Suggested Layer**: E2E

### TC-020: Clear all bookings in one action
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User has 2+ bookings
**Steps**:
1. On `/bookings`, click "Clear all bookings"
2. Accept the native browser `confirm()` dialog
**Expected Results**: `DELETE /api/bookings` (no id) removes all of the user's bookings; list becomes empty; empty state displays
**Business Rule**: "Clear All Bookings" (business-rules.md #4)
**Suggested Layer**: E2E

### TC-021: Retrieve a booking by its reference code
**Category**: Happy Path
**Priority**: P2
**Preconditions**: A known valid `bookingRef` owned by the user
**Steps**:
1. Call `GET /api/bookings/ref/:ref` with a valid Bearer token
**Expected Results**: 200, returns the matching booking
**Business Rule**: API reference — `GET /api/bookings/ref/:ref`
**Suggested Layer**: API

### TC-022: Create a new event via the Admin UI
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Logged-in user with fewer than 6 dynamic events
**Steps**:
1. Navigate to `/admin/events`
2. Fill title, category, city, venue, future date, price, total seats
3. Click "+ Add Event" (`#add-event-btn`)
**Expected Results**: "Event created!" toast; new event appears in the table below; form resets to empty
**Business Rule**: Admin - Manage Events (user-flows.md Flow 5)
**Suggested Layer**: E2E

### TC-023: Edit an existing dynamic event via the Admin UI
**Category**: Happy Path
**Priority**: P1
**Preconditions**: A dynamic event owned by the user
**Steps**:
1. Click "Edit" on the event row
2. Change one or more fields
3. Click "💾 Update Event"
**Expected Results**: "Event updated!" toast; table reflects the new values; form clears and returns to "+ New Event" mode
**Business Rule**: Admin - Manage Events (user-flows.md Flow 5)
**Suggested Layer**: E2E

### TC-024: Delete a dynamic event via the Admin UI
**Category**: Happy Path
**Priority**: P1
**Preconditions**: A dynamic event owned by the user, with or without bookings
**Steps**:
1. Click "Delete" on the event row
2. Confirm in the dialog ("This will permanently delete the event and all associated bookings.")
**Expected Results**: Event removed from the table (optimistic update); `DELETE /api/events/:id` succeeds; any bookings for that event are cascade-deleted
**Business Rule**: Admin - Manage Events (user-flows.md Flow 5); cascade delete (business-rules.md #2)
**Suggested Layer**: E2E

### TC-025: View admin events table with pagination
**Category**: Happy Path
**Priority**: P2
**Preconditions**: More than 10 events (static + dynamic) exist for the user
**Steps**:
1. Navigate to `/admin/events`
2. Navigate to page 2 of the table
**Expected Results**: Table paginates at 10 rows/page; total count shown in the section header
**Business Rule**: Discovered UI behavior (`admin/events/page.tsx` `limit: 10`)
**Suggested Layer**: Component

### TC-026: Admin views a booking via read-only modal
**Category**: Happy Path
**Priority**: P2
**Preconditions**: Logged in as a user with existing bookings; on `/admin/bookings`
**Steps**:
1. Click "View" on a booking row
**Expected Results**: Modal opens showing booking details sourced from already-fetched row data (no extra API call fired)
**Business Rule**: Admin UI behavior (discovered: `admin/bookings/page.tsx`)
**Suggested Layer**: Component

### TC-027: Admin cancels a confirmed booking
**Category**: Happy Path
**Priority**: P1
**Preconditions**: A booking with `status === 'confirmed'` visible on `/admin/bookings`
**Steps**:
1. Click "Cancel" on the row
2. Confirm the dialog ("This will cancel the booking and restore the seats to the event.")
**Expected Results**: Booking status updates / row removed per filter; seats restored per per-user seat math
**Business Rule**: Admin UI behavior; per-user seat availability (business-rules.md #6)
**Suggested Layer**: E2E

### TC-028: Filter admin bookings by status
**Category**: Happy Path
**Priority**: P2
**Preconditions**: Bookings exist with both confirmed and cancelled status
**Steps**:
1. On `/admin/bookings`, select "Confirmed" from the status filter dropdown
2. Then select "Cancelled"
**Expected Results**: Table rows update to match the selected filter each time; "Cancel" action button only shown for rows where `status === 'confirmed'`
**Business Rule**: Admin UI behavior (`admin/bookings/page.tsx` status filter)
**Suggested Layer**: Component

---

## Business Rules (TC-100–TC-199)

### TC-100: Server-side password policy is weaker than the UI's strength meter
**Category**: Business Rule
**Priority**: P1
**Preconditions**: None
**Steps**:
1. Call `POST /api/auth/register` directly with `password: "abcdef"` (6 chars, no uppercase/number/symbol)
**Expected Results**: Registration succeeds (201) — the backend's inline `validateAuth` in `authRoutes.js` only enforces `password.length >= 6`; the register page's 4-rule strength checklist (8+ chars, uppercase, number, symbol) is UI-only and not mirrored server-side
**Business Rule**: Discovered divergence between `authRoutes.js` `validateAuth` and `frontend/app/register/page.tsx` `PASSWORD_RULES`
**Suggested Layer**: API

### TC-101: Duplicate email registration is rejected
**Category**: Business Rule
**Priority**: P0
**Preconditions**: An email already registered
**Steps**:
1. Call `POST /api/auth/register` with that email
**Expected Results**: 400, "Email already registered" (`ValidationError` from `authService.register`)
**Business Rule**: Error scenarios (api-reference.md)
**Suggested Layer**: API

### TC-102: Login error message is identical for "unknown email" and "wrong password"
**Category**: Business Rule
**Priority**: P1
**Preconditions**: One case with a nonexistent email, one with a correct email but wrong password
**Steps**:
1. Attempt login for each case
**Expected Results**: Both return the same 400 error, "Invalid email or password" — `authService.login` deliberately does not distinguish the two, preventing user enumeration. Note this contradicts the Swagger doc on `authRoutes.js` (which documents a 404 "User not found" case for unknown email) — the documented 404 branch does not actually exist in `authService.js`.
**Business Rule**: Discovered code behavior (`authService.js` login) vs stale Swagger doc (`authRoutes.js` `/auth/login` 404 response)
**Suggested Layer**: API

### TC-103: JWT tokens are valid for 7 days
**Category**: Business Rule
**Priority**: P2
**Preconditions**: A freshly issued token
**Steps**:
1. Decode the JWT and inspect `exp`
**Expected Results**: Expiry is exactly 7 days from issuance (`expiresIn: '7d'`)
**Business Rule**: Auth is JWT-based, 7-day expiry (CLAUDE.md architecture notes)
**Suggested Layer**: Unit

### TC-104: Event limit enforces FIFO pruning at the 7th user-created event
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User already has exactly 6 dynamic events (oldest known)
**Steps**:
1. Create a 7th dynamic event
**Expected Results**: 7th event is created successfully; the oldest (1st) dynamic event is automatically deleted along with any of its bookings (cascade); user now has exactly 6 dynamic events
**Business Rule**: Event limits FIFO pruning (business-rules.md #3)
**Suggested Layer**: API

### TC-105: Static events are excluded from the 6-event limit and cannot be edited or deleted
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has 6 dynamic events plus visibility into static (seeded) events
**Steps**:
1. Create a 7th dynamic event
2. Attempt `PUT`/`DELETE` on a static event id
**Expected Results**: Static events never count toward the 6-event limit or get auto-pruned; edit/delete on a static event returns 403 "Cannot modify a static event" / "Cannot delete a static event"
**Business Rule**: Event limits (business-rules.md #3)
**Suggested Layer**: API

### TC-106: Booking reference first letter matches event title
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Events with varied titles, including lowercase and special-character-leading titles (e.g. "the Gig", "3rd Annual Meet")
**Steps**:
1. Book each event
2. Inspect the returned `bookingRef`
**Expected Results**: Ref prefix is the UPPERCASED first character of the title in every case (e.g. "the Gig" → `T-...`, "3rd Annual Meet" → `3-...`)
**Business Rule**: Booking reference format (business-rules.md #7)
**Suggested Layer**: API

### TC-107: Booking reference is unique via collision retry
**Category**: Business Rule
**Priority**: P2
**Preconditions**: Ability to force/mimic a reference collision (unit-level, mock the random generator to force a first attempt to collide)
**Steps**:
1. Trigger booking creation such that the first generated ref already exists
**Expected Results**: Service retries (up to 10 times) with a new random suffix; after 10 failed attempts falls back to `${prefix}-${Date.now().toString(36)}` (different shape/length) — reference is still unique and valid
**Business Rule**: Booking reference format (business-rules.md #7); discovered fallback in `bookingService.js`
**Suggested Layer**: Unit

### TC-108: Per-user seat math allows same-event "double booking" across users
**Category**: Business Rule
**Priority**: P0
**Preconditions**: A dynamic event with `totalSeats = 10`, owned by User A; User A and User B both have accounts
**Steps**:
1. User A books 5 seats
2. User B books 5 seats for the same event
**Expected Results**: Both bookings succeed — dynamic events compute per-user availability as `totalSeats - sum(that user's own quantities)`, not a shared pool; User A still sees 5 available (10 - their own 5), independent of User B's booking
**Business Rule**: Per-user seat availability (business-rules.md #6)
**Suggested Layer**: API

### TC-109: Static event seat availability is a shared, decremented pool
**Category**: Business Rule
**Priority**: P0
**Preconditions**: A static event with `availableSeats = 5`
**Steps**:
1. User A books 3 seats
2. User B books 3 seats
**Expected Results**: User A's booking succeeds (5→2 available); User B's booking of 3 fails with `InsufficientSeatsError` since only 2 remain — static events use one shared `availableSeats` DB column, unlike dynamic events
**Business Rule**: Per-user seat availability (business-rules.md #6)
**Suggested Layer**: API

### TC-110: Booking limit enforces FIFO pruning at the 10th booking
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User already has exactly 9 bookings (oldest known), for a mix of events
**Steps**:
1. Create a 10th booking for a different event than the oldest
**Expected Results**: 10th booking is created successfully; the oldest (1st) booking is automatically deleted; user now has exactly 9 bookings, with the previously-oldest one gone and its seats restored
**Business Rule**: Booking limits FIFO pruning (business-rules.md #4)
**Suggested Layer**: API

### TC-111: FIFO booking pruning prefers a different event, but burns a seat if forced to prune the same event
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has exactly 9 bookings, ALL for the same single event
**Steps**:
1. Create a 10th booking for that SAME event
**Expected Results**: `findOldestUserBookingExcludingEvent` finds nothing (all 9 are for this event), so the service falls back to the oldest booking overall (`sameEventFallback = true`), deletes it, then **permanently decrements the event's `availableSeats` by the new booking's quantity** (`eventRepository.decrementSeats`) — unlike the normal cross-event prune, this path burns a real seat rather than relying on the dynamic per-user computation to reflect availability. Verify the event's `totalSeats`/`availableSeats` actually decreases in the DB, not just the computed per-user value.
**Business Rule**: Discovered code behavior in `bookingService.js createBooking` (`sameEventFallback` branch) — not documented anywhere in business-rules.md
**Suggested Layer**: API

### TC-112: Cancelling a booking immediately frees seats for future booking
**Category**: Business Rule
**Priority**: P1
**Preconditions**: A dynamic event fully booked out by the current user (0 personal seats remaining)
**Steps**:
1. Cancel one existing booking for that event
2. Attempt to book 1 seat again for the same event
**Expected Results**: Cancellation succeeds; the subsequent booking of 1 seat now succeeds since availability recalculates immediately
**Business Rule**: Booking deletion frees seats (business-rules.md #4); per-user seat availability (#6)
**Suggested Layer**: API

### TC-113: totalPrice always equals price × quantity, including decimal prices
**Category**: Business Rule
**Priority**: P1
**Preconditions**: An event with a decimal price (e.g. 199.50)
**Steps**:
1. Book quantity 3
**Expected Results**: `totalPrice = 598.50` exactly (no floating-point rounding drift)
**Business Rule**: Price calculation (business-rules.md #9)
**Suggested Layer**: Unit

### TC-114: Refund eligibility boundary at quantity exactly 1 vs 2
**Category**: Business Rule
**Priority**: P1
**Preconditions**: Two bookings — one qty=1, one qty=2
**Steps**:
1. Check refund eligibility on each
**Expected Results**: qty=1 → refundable message; qty=2 → non-refundable message referencing "Group bookings (2 tickets)" — confirms the boundary is strictly `quantity === 1`
**Business Rule**: Refund eligibility (business-rules.md #8)
**Suggested Layer**: Component

### TC-115: Refund eligibility check has no backend persistence
**Category**: Business Rule
**Priority**: P2
**Preconditions**: A booking; refund check performed once
**Steps**:
1. Check refund eligibility
2. Reload the booking detail page
3. Check refund eligibility again
**Expected Results**: No stored "refund requested/checked" state on the backend — the check re-runs the same 4s client-side computation each time; no new API calls fired for the refund check itself
**Business Rule**: "Refund eligibility is frontend-only (no backend endpoint)" (business-rules.md #8, CLAUDE.md)
**Suggested Layer**: E2E

### TC-116: Sandbox limit banner appears only on the Events page, combining both limits in one message
**Category**: Business Rule
**Priority**: P2
**Preconditions**: User views `/events` with more than 5 events displayed
**Steps**:
1. Navigate to `/events` with 6+ events, then again with 5 or fewer
**Expected Results**: A single banner referencing BOTH the 9-booking and 6-event sandbox limits appears when the displayed event count exceeds 5, and is hidden otherwise. **Correction to business-rules.md #5**, which implies a separate conditional banner also exists on the Bookings page — code inspection of `frontend/app/bookings/page.tsx` shows no such banner exists there; only `frontend/app/events/page.tsx` (`events.length > 5`) renders it.
**Business Rule**: Sandbox warning banners (business-rules.md #5) — corrected per `events/page.tsx` code inspection
**Suggested Layer**: Component

---

## Security (TC-200–TC-299)

### TC-200: Cross-user access to another user's booking via GET returns 403
**Category**: Security
**Priority**: P0
**Preconditions**: User A creates a booking and notes its id; User B is logged in
**Steps**:
1. As User B, call `GET /api/bookings/:userA_booking_id`
**Expected Results**: 403 Forbidden, message "You are not authorized to view this booking"; frontend shows "Access Denied" (not "Booking not found") on `/bookings/:id`
**Business Rule**: Cross-user access returns 403 (business-rules.md #2, api-reference.md); confirmed message differs from getByRef
**Suggested Layer**: API

### TC-201: Cross-user access via booking reference lookup returns 403
**Category**: Security
**Priority**: P0
**Preconditions**: User A's booking has a known `bookingRef`; User B is logged in
**Steps**:
1. As User B, call `GET /api/bookings/ref/:userA_ref`
**Expected Results**: 403 Forbidden, message "You do not own this booking"
**Business Rule**: Cross-user access returns 403 (business-rules.md #2)
**Suggested Layer**: API

### TC-202: Cross-user cancellation attempt returns 404, not 403
**Category**: Security
**Priority**: P0
**Preconditions**: User A's booking id known; User B logged in
**Steps**:
1. As User B, call `DELETE /api/bookings/:userA_booking_id`
**Expected Results**: 404 Not Found ("Booking with id X not found") — NOT 403. The repository's `findById(id, userId)` pre-scopes by user, so a foreign booking id simply never matches. This is a documented divergence from the read-endpoint 403 behavior; the booking is NOT deleted and User A retains it.
**Business Rule**: Discovered code behavior (`bookingRepository.findById` scoping) — differs from api-reference.md's blanket "cross-user booking access → 403" claim
**Suggested Layer**: API

### TC-203: Missing auth token on any protected endpoint is rejected
**Category**: Security
**Priority**: P0
**Preconditions**: None
**Steps**:
1. Call `GET /api/bookings`, `POST /api/bookings`, `DELETE /api/bookings/:id`, `GET /api/events`, `POST /api/events` with no Authorization header
**Expected Results**: 401 Unauthorized, message "Unauthorized" for each
**Business Rule**: Missing auth token (api-reference.md)
**Suggested Layer**: API

### TC-204: Expired or malformed JWT is rejected
**Category**: Security
**Priority**: P0
**Preconditions**: An expired JWT (>7 days old) or a tampered token string
**Steps**:
1. Call `GET /api/bookings` with the bad token
**Expected Results**: 401, message "Invalid or expired token"
**Business Rule**: Auth middleware behavior (`authMiddleware.js`)
**Suggested Layer**: API

### TC-205: Stale/expired session mid-page doesn't auto-redirect
**Category**: Security
**Priority**: P2
**Preconditions**: Logged-in user on `/bookings`; token expires/is invalidated server-side without a page reload
**Steps**:
1. Perform an action that calls the API (e.g. cancel a booking) after expiry
**Expected Results**: The request fails with 401 and surfaces as an inline error toast; the user is NOT automatically redirected to `/login` (no global 401 interceptor exists) until the next full mount/reload triggers `AuthGuard`
**Business Rule**: Discovered code gap in `AuthGuard.tsx` / `lib/api/client.ts` — no global 401 interceptor
**Suggested Layer**: E2E

### TC-206: Tampering with quantity/price client-side cannot bypass server validation
**Category**: Security
**Priority**: P1
**Preconditions**: Logged-in user
**Steps**:
1. Bypass the UI and call `POST /api/bookings` directly with `quantity: 999` or a negative `totalPrice` override in the payload
**Expected Results**: `totalPrice` is always server-computed from `event.price x quantity` server-side (client-supplied totalPrice, if any, is ignored); `quantity: 999` rejected by validator (max 10) regardless of UI stepper limits
**Business Rule**: Price calculation (business-rules.md #9); quantity validator max 10
**Suggested Layer**: API

### TC-207: IDOR — enumerate sequential booking ids across users
**Category**: Security
**Priority**: P1
**Preconditions**: Two accounts, each with bookings, ids known to be sequential integers
**Steps**:
1. As User B, iterate `GET /api/bookings/:id` across a range of ids including User A's
**Expected Results**: Every id not owned by User B returns 403 (own ids return 200); no data leakage of other users' booking details in the response body
**Business Rule**: Cross-user access returns 403 (business-rules.md #2)
**Suggested Layer**: API

### TC-208: Booking another user's dynamic event via a crafted eventId is allowed
**Category**: Security
**Priority**: P2
**Preconditions**: User A owns a dynamic event; User B logged in
**Steps**:
1. As User B, `POST /api/bookings` with `eventId` = User A's dynamic event id
**Expected Results**: Booking succeeds (dynamic events are bookable by any authenticated user, not owner-restricted — this is intentional per sandbox design). Confirm this is expected and not an unintended privilege leak by cross-checking that only edit/delete of events is ownership-restricted, not booking creation.
**Business Rule**: Distinguish "own an event" (edit/delete restricted) vs "book an event" (unrestricted) — business-rules.md #2 scopes bookings/events visibility, not bookability
**Suggested Layer**: API

### TC-209: Editing another user's dynamic event is forbidden
**Category**: Security
**Priority**: P0
**Preconditions**: User A owns a dynamic event; User B logged in
**Steps**:
1. As User B, call `PUT /api/events/:userA_event_id`
**Expected Results**: 403 Forbidden, "You do not own this event"
**Business Rule**: Discovered code behavior (`eventService.updateEvent` ownership check)
**Suggested Layer**: API

### TC-210: Deleting another user's dynamic event is forbidden
**Category**: Security
**Priority**: P0
**Preconditions**: User A owns a dynamic event; User B logged in
**Steps**:
1. As User B, call `DELETE /api/events/:userA_event_id`
**Expected Results**: 403 Forbidden, "You do not own this event"
**Business Rule**: Discovered code behavior (`eventService.deleteEvent` ownership check)
**Suggested Layer**: API

### TC-211: Editing or deleting a static event is forbidden regardless of user
**Category**: Security
**Priority**: P1
**Preconditions**: Any authenticated user; a static (seeded) event id
**Steps**:
1. Call `PUT /api/events/:staticId` and separately `DELETE /api/events/:staticId`
**Expected Results**: Both return 403 ("Cannot modify a static event" / "Cannot delete a static event") for every user, including the account that created no events at all
**Business Rule**: Static events cannot be edited or deleted (business-rules.md #3)
**Suggested Layer**: API

### TC-212: Password hash is never present in any auth API response
**Category**: Security
**Priority**: P1
**Preconditions**: A registered user
**Steps**:
1. Inspect the full JSON response bodies of `POST /api/auth/register`, `POST /api/auth/login`, and `GET /api/auth/me`
**Expected Results**: None of the responses include a `password` field (hashed or plaintext) — only `{ id/userId, email }` and the token
**Business Rule**: Discovered code behavior (`authService.js` explicitly returns `{ id, email }`, never the full user row)
**Suggested Layer**: API

---

## Negative / Error Scenarios (TC-300–TC-399)

### TC-300: Booking with customerName shorter than 2 characters is rejected
**Category**: Negative
**Priority**: P1
**Preconditions**: None
**Steps**:
1. Submit booking with `customerName: "A"`
**Expected Results**: 400, "Customer name must be at least 2 characters"; frontend shows "Name must be at least 2 chars" without hitting the API if caught client-side
**Business Rule**: `bookingValidator.js` customerName rule
**Suggested Layer**: API

### TC-301: Booking with invalid email format is rejected
**Category**: Negative
**Priority**: P1
**Preconditions**: None
**Steps**:
1. Submit booking with `customerEmail: "not-an-email"`
**Expected Results**: 400 validation error (isEmail fails)
**Business Rule**: `bookingValidator.js` customerEmail rule
**Suggested Layer**: API

### TC-302: Booking phone number failing character whitelist is rejected
**Category**: Negative
**Priority**: P1
**Preconditions**: None
**Steps**:
1. Submit booking with `customerPhone: "call-me-maybe"` (contains letters)
**Expected Results**: 400, "Customer phone must contain only digits and +, -, spaces, or parentheses"
**Business Rule**: `bookingValidator.js` customerPhone regex `/^[0-9+\-\s()]+$/`
**Suggested Layer**: API

### TC-303: Booking phone number under 10 characters is rejected
**Category**: Negative
**Priority**: P1
**Preconditions**: None
**Steps**:
1. Submit booking with `customerPhone: "123"`
**Expected Results**: 400, min-length validation error — note this checks raw string length (min 10 chars including any `+`/`-`/spaces), NOT digit count, unlike the frontend's stricter "10 digits after stripping non-digits" check
**Business Rule**: `bookingValidator.js` customerPhone `isLength({min:10})` vs frontend's `replace(/\D/g,'')` digit-count check — worth an explicit divergence test
**Suggested Layer**: API + Component (compare both layers)

### TC-304: Booking quantity of 0 is rejected
**Category**: Negative
**Priority**: P1
**Preconditions**: None
**Steps**:
1. Submit booking with `quantity: 0`
**Expected Results**: 400, "Quantity must be an integer between 1 and 10"
**Business Rule**: `bookingValidator.js` quantity rule
**Suggested Layer**: API

### TC-305: Booking quantity of 11 is rejected
**Category**: Negative
**Priority**: P1
**Preconditions**: None
**Steps**:
1. Submit booking with `quantity: 11`
**Expected Results**: 400, "Quantity must be an integer between 1 and 10"
**Business Rule**: `bookingValidator.js` quantity rule (max 10)
**Suggested Layer**: API

### TC-306: Booking with non-integer or negative eventId is rejected
**Category**: Negative
**Priority**: P2
**Preconditions**: None
**Steps**:
1. Submit booking with `eventId: -1` and separately `eventId: "abc"`
**Expected Results**: 400, "Event ID must be a positive integer" in both cases
**Business Rule**: `bookingValidator.js` eventId rule
**Suggested Layer**: API

### TC-307: Booking for a non-existent eventId returns 404
**Category**: Negative
**Priority**: P1
**Preconditions**: An eventId guaranteed not to exist (e.g. 999999999)
**Steps**:
1. Submit `POST /api/bookings` with that eventId
**Expected Results**: 404 Not Found
**Business Rule**: Standard not-found handling via `errorHandler.js`
**Suggested Layer**: API

### TC-308: Booking with insufficient available seats is rejected
**Category**: Negative
**Priority**: P0
**Preconditions**: An event with only 2 seats available (to this user)
**Steps**:
1. Attempt to book quantity 3
**Expected Results**: 400 `InsufficientSeatsError`: "Only 2 seat(s) available, but 3 requested"
**Business Rule**: Seat availability check (`bookingService.js`)
**Suggested Layer**: API

### TC-309: Booking a fully sold-out event is blocked in the UI
**Category**: Negative
**Priority**: P1
**Preconditions**: Event with `availableSeats === 0` for this user
**Steps**:
1. Navigate to the event detail page
**Expected Results**: "Confirm Booking" button is disabled and labeled "Sold Out"; no submission possible from the UI
**Business Rule**: Discovered UI behavior (`events/[id]/page.tsx` soldOut disabled state)
**Suggested Layer**: Component

### TC-310: Missing required booking fields are rejected
**Category**: Negative
**Priority**: P1
**Preconditions**: None
**Steps**:
1. Submit `POST /api/bookings` omitting `customerEmail`
2. Repeat omitting `customerPhone`, then `quantity`, then `eventId`
**Expected Results**: 400 validation error for each missing field, with per-field messages, not a generic error
**Business Rule**: `bookingValidator.js` notEmpty rules
**Suggested Layer**: API

### TC-311: Cancelling an already-cancelled/nonexistent booking returns 404
**Category**: Negative
**Priority**: P2
**Preconditions**: A booking id that has already been deleted, or never existed
**Steps**:
1. Call `DELETE /api/bookings/:id` for that id
**Expected Results**: 404, "Booking with id X not found" (Prisma P2025 mapped or explicit NotFoundError)
**Business Rule**: `errorHandler.js` P2025 mapping
**Suggested Layer**: API

### TC-312: Clear-all-bookings when there are zero bookings is a no-op
**Category**: Negative
**Priority**: P3
**Preconditions**: User has no bookings
**Steps**:
1. Call `DELETE /api/bookings`
**Expected Results**: Succeeds without error (nothing to delete); response indicates 0 bookings removed or an empty success message
**Business Rule**: Edge behavior of clear-all
**Suggested Layer**: API

### TC-313: Concurrent bookings against the last seat of a static event don't oversell
**Category**: Negative
**Priority**: P3
**Preconditions**: A static event at exactly 1 seat remaining
**Steps**:
1. Fire two concurrent booking requests for quantity 1 each against the same static event
**Expected Results**: Only one succeeds; the other receives `InsufficientSeatsError` — the seat decrement must be transactional/atomic (per CLAUDE.md's note that booking creation is transactional in `bookingService.js`), not a race condition that oversells
**Business Rule**: Transactional booking creation (CLAUDE.md architecture notes)
**Suggested Layer**: API (concurrency test)

### TC-314: Creating an event with missing required fields is rejected field-by-field
**Category**: Negative
**Priority**: P1
**Preconditions**: None
**Steps**:
1. Submit `POST /api/events` omitting `title`, then separately omitting `category`, `venue`, `city`, `eventDate`, `price`, `totalSeats`
**Expected Results**: 400 with a per-field message each time (e.g. "Title is required", "Category is required", …)
**Business Rule**: `eventValidator.js` notEmpty rules
**Suggested Layer**: API

### TC-315: Creating an event with a past eventDate is rejected
**Category**: Negative
**Priority**: P0
**Preconditions**: None
**Steps**:
1. Submit `POST /api/events` with `eventDate` set to yesterday
**Expected Results**: 400, "Event date must be in the future"
**Business Rule**: Invalid event date (api-reference.md); `eventValidator.js` custom date check
**Suggested Layer**: API

### TC-316: Creating an event with a negative price is rejected
**Category**: Negative
**Priority**: P1
**Preconditions**: None
**Steps**:
1. Submit `POST /api/events` with `price: -10`
**Expected Results**: 400, "Price must be a non-negative number"
**Business Rule**: `eventValidator.js` price `isFloat({min:0})`
**Suggested Layer**: API

### TC-317: Creating an event with totalSeats of 0 is rejected
**Category**: Negative
**Priority**: P1
**Preconditions**: None
**Steps**:
1. Submit `POST /api/events` with `totalSeats: 0`
**Expected Results**: 400, "Total seats must be a positive integer"
**Business Rule**: `eventValidator.js` totalSeats `isInt({min:1})`
**Suggested Layer**: API

### TC-318: Creating an event with a malformed imageUrl is rejected
**Category**: Negative
**Priority**: P2
**Preconditions**: None
**Steps**:
1. Submit `POST /api/events` with `imageUrl: "not-a-url"`
**Expected Results**: 400, "Image URL must be a valid URL" (only validated when the field is truthy — `checkFalsy: true` allows omission)
**Business Rule**: `eventValidator.js` imageUrl optional/isURL rule
**Suggested Layer**: API

### TC-319: Updating a nonexistent event id returns 404
**Category**: Negative
**Priority**: P2
**Preconditions**: An eventId guaranteed not to exist
**Steps**:
1. Call `PUT /api/events/:id`
**Expected Results**: 404, "Event with id X not found"
**Business Rule**: `eventService.updateEvent` NotFoundError
**Suggested Layer**: API

### TC-320: Deleting a nonexistent event id returns 404
**Category**: Negative
**Priority**: P2
**Preconditions**: An eventId guaranteed not to exist
**Steps**:
1. Call `DELETE /api/events/:id`
**Expected Results**: 404, "Event with id X not found"
**Business Rule**: `eventService.deleteEvent` NotFoundError
**Suggested Layer**: API

### TC-321: Register with an invalid email format is rejected
**Category**: Negative
**Priority**: P1
**Preconditions**: None
**Steps**:
1. Submit `POST /api/auth/register` with `email: "not-an-email"`
**Expected Results**: 400, "A valid email is required"
**Business Rule**: `authRoutes.js` inline `validateAuth`
**Suggested Layer**: API

### TC-322: Register with a password shorter than 6 characters is rejected
**Category**: Negative
**Priority**: P1
**Preconditions**: None
**Steps**:
1. Submit `POST /api/auth/register` with `password: "abc12"` (5 chars)
**Expected Results**: 400, "Password must be at least 6 characters"
**Business Rule**: `authRoutes.js` inline `validateAuth`
**Suggested Layer**: API

### TC-323: Login with a wrong password for an existing account is rejected
**Category**: Negative
**Priority**: P0
**Preconditions**: A registered account
**Steps**:
1. Submit `POST /api/auth/login` with the correct email and an incorrect password
**Expected Results**: 400, "Invalid email or password"
**Business Rule**: `authService.login`
**Suggested Layer**: API

### TC-324: Login with a nonexistent email is rejected
**Category**: Negative
**Priority**: P0
**Preconditions**: An email that has never been registered
**Steps**:
1. Submit `POST /api/auth/login` with that email
**Expected Results**: 400, "Invalid email or password" (same message as wrong-password, see TC-102)
**Business Rule**: `authService.login`
**Suggested Layer**: API

### TC-325: Register/login with a missing email or password field is rejected
**Category**: Negative
**Priority**: P2
**Preconditions**: None
**Steps**:
1. Submit `POST /api/auth/register` and `POST /api/auth/login` each omitting `email`, then each omitting `password`
**Expected Results**: 400 validation error in every case, naming the missing field
**Business Rule**: `authRoutes.js` inline `validateAuth`
**Suggested Layer**: API

---

## Edge Cases (TC-400–TC-499)

### TC-400: Book exactly the maximum allowed quantity (10)
**Category**: Edge Case
**Priority**: P1
**Preconditions**: Event with ≥10 seats available
**Steps**:
1. Set quantity to 10 via stepper (or API)
2. Submit booking
**Expected Results**: Booking succeeds with `quantity: 10`; `+` stepper button becomes disabled at 10; `totalPrice = price x 10`
**Business Rule**: `bookingValidator.js` quantity max 10; UI stepper max
**Suggested Layer**: Component + API

### TC-401: Quantity stepper capped at min(10, availableSeats)
**Category**: Edge Case
**Priority**: P1
**Preconditions**: A dynamic event with only 4 seats available to the current user
**Steps**:
1. Open the event detail page
2. Attempt to increase quantity past 4 using the `+` stepper
**Expected Results**: Stepper disables at 4 (not 10), since `maxQty = Math.min(10, event.availableSeats)`
**Business Rule**: Discovered UI behavior (`events/[id]/page.tsx` `maxQty`)
**Suggested Layer**: Component

### TC-402: Booking exactly 9 bookings, then the 10th triggers FIFO pruning boundary
**Category**: Edge Case
**Priority**: P0
**Preconditions**: User starts with 0 bookings
**Steps**:
1. Create bookings 1 through 9 sequentially (across at least 2 different events), noting each booking id/ref
2. Create a 10th booking for a different event than booking #1
**Expected Results**: After the 9th, all 9 exist. After the 10th, exactly 9 remain: booking #1 (oldest) is gone, bookings #2–#10 remain. Verify boundary precisely at 9→10, not 10→11.
**Business Rule**: Booking limits FIFO pruning (business-rules.md #4)
**Suggested Layer**: API

### TC-403: customerName exactly 2 characters (minimum boundary) is accepted
**Category**: Edge Case
**Priority**: P2
**Preconditions**: None
**Steps**:
1. Submit booking with `customerName: "Al"` (exactly 2 chars)
**Expected Results**: Accepted (boundary is inclusive, `isLength({min:2})`)
**Business Rule**: `bookingValidator.js` customerName rule
**Suggested Layer**: API

### TC-404: customerPhone exactly 10 characters (minimum boundary) is accepted
**Category**: Edge Case
**Priority**: P2
**Preconditions**: None
**Steps**:
1. Submit booking with `customerPhone: "1234567890"` (exactly 10 digits, no formatting chars)
**Expected Results**: Accepted
**Business Rule**: `bookingValidator.js` customerPhone rule
**Suggested Layer**: API

### TC-405: customerPhone with formatting characters reduces raw length below digit count
**Category**: Edge Case
**Priority**: P2
**Preconditions**: None
**Steps**:
1. Submit `customerPhone: "(123) 456-7890"` (raw length 14); separately submit `"123-456-78"` (10 raw chars but only 8 digits)
**Expected Results**: Backend validates raw string length ≥10 AND whitelist chars only — a value like `"123-456-78"` (10 raw chars, 8 digits) passes the backend's `isLength({min:10})` despite having fewer than 10 actual digits; this is a real gap since the frontend's stricter digit-count check would reject it, creating a bypass path via direct API calls
**Business Rule**: Discovered validator divergence (`bookingValidator.js` vs `events/[id]/page.tsx` phone logic)
**Suggested Layer**: API

### TC-406: customerEmail normalization alters the stored email (Gmail dot/plus handling)
**Category**: Edge Case
**Priority**: P2
**Preconditions**: None
**Steps**:
1. Submit booking with `customerEmail: "John.Doe+test@gmail.com"`
**Expected Results**: `normalizeEmail()` may lowercase, strip dots, and remove the `+tag` portion for Gmail addresses (e.g. becomes `johndoe@gmail.com`) — verify the stored/returned `customerEmail` reflects normalization, which could surprise users expecting their exact input preserved
**Business Rule**: Discovered validator behavior (`bookingValidator.js` `normalizeEmail()`)
**Suggested Layer**: API

### TC-407: Event title starting with a digit or special character produces a valid ref prefix
**Category**: Edge Case
**Priority**: P2
**Preconditions**: An event titled e.g. "3rd Annual Meet" or "#1 Concert"
**Steps**:
1. Book the event
**Expected Results**: `bookingRef` prefix is `3-` or `#-` respectively (uppercased first character, even if non-alphabetic) — confirm no crash/exception on non-letter first characters
**Business Rule**: Booking reference format (business-rules.md #7)
**Suggested Layer**: API

### TC-408: Refund eligibility text pluralization at exactly quantity 2
**Category**: Edge Case
**Priority**: P3
**Preconditions**: A booking with quantity exactly 2
**Steps**:
1. Check refund eligibility
**Expected Results**: Message correctly reads "Group bookings (2 tickets) are non-refundable" — verify no off-by-one in the interpolated count and correct singular/plural noun usage at the boundary
**Business Rule**: Refund eligibility (business-rules.md #8)
**Suggested Layer**: Component

### TC-409: Booking price of exactly 0 (free event)
**Category**: Edge Case
**Priority**: P3
**Preconditions**: An event with `price = 0`
**Steps**:
1. Book quantity 5
**Expected Results**: `totalPrice = 0`; booking succeeds (price >= 0 is valid per event validator)
**Business Rule**: Price calculation (business-rules.md #9); event price `isFloat({min:0})`
**Suggested Layer**: API

### TC-410: Booking reference collision fallback shape after 10 failed retries
**Category**: Edge Case
**Priority**: P3
**Preconditions**: Mocked/forced scenario where 10 consecutive random suffixes collide
**Steps**:
1. Force all 10 retry attempts to collide (unit test with mocked repository existence check)
**Expected Results**: Falls back to `${prefix}-${Date.now().toString(36)}` — a differently-shaped ref (variable length, base36 timestamp instead of 6 random alphanumeric chars); verify downstream code (e.g. ref-based lookup, display formatting) tolerates this shape without breaking
**Business Rule**: Discovered fallback logic in `bookingService.js`
**Suggested Layer**: Unit

### TC-411: Event limit FIFO boundary at exactly 6 → 7 events
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User starts with 0 dynamic events
**Steps**:
1. Create dynamic events 1 through 6, noting ids
2. Create a 7th event
**Expected Results**: After the 6th, all 6 exist. After the 7th, exactly 6 remain: event #1 (oldest) is gone (with cascade-deleted bookings), events #2–#7 remain. Boundary is precisely at 6→7, not 7→8.
**Business Rule**: Event limits FIFO pruning (business-rules.md #3)
**Suggested Layer**: API

### TC-412: Filtering events by "Pune" returns an empty result despite being a valid dropdown option
**Category**: Edge Case
**Priority**: P3
**Preconditions**: Only the 5 documented seed cities (Bangalore/Mumbai/Hyderabad/Delhi/Chennai) have static events; no dynamic event created in Pune
**Steps**:
1. On `/events`, select "Pune" from the city filter
**Expected Results**: `CITIES` in `EventFilters.jsx` lists "Pune" as a selectable option, but no seeded events use that city — result is the "No events found" empty state, not an error. Confirms the filter dropdown's option list isn't strictly derived from actual event data.
**Business Rule**: Discovered UI/data mismatch (`EventFilters.jsx` `CITIES` vs seeded cities in `prisma/seed.js`)
**Suggested Layer**: Component

### TC-413: Register password at exactly the 8-character minimum with one of each required class is accepted
**Category**: Edge Case
**Priority**: P2
**Preconditions**: None
**Steps**:
1. Enter password `"Abcdef1!"` (exactly 8 chars, 1 uppercase, 1 number, 1 symbol) on `/register`
**Expected Results**: All 4 checklist items turn green; form submits successfully
**Business Rule**: `register/page.tsx` `PASSWORD_RULES` boundary
**Suggested Layer**: Component

### TC-414: Login password at exactly the 6-character server-side minimum is accepted
**Category**: Edge Case
**Priority**: P3
**Preconditions**: A registered account whose password is exactly 6 characters (registered via API per TC-100)
**Steps**:
1. Log in with that 6-character password
**Expected Results**: Login succeeds — the login page's own client-side check (`password.length < 6`) and the backend's `validateAuth` agree on this boundary
**Business Rule**: `login/page.tsx` validate() vs `authRoutes.js` `validateAuth`
**Suggested Layer**: Component + API

---

## UI State (TC-500–TC-599)

### TC-500: Bookings list loading state shows skeletons
**Category**: UI State
**Priority**: P2
**Preconditions**: Simulate a slow `/api/bookings` response
**Steps**:
1. Navigate to `/bookings` and observe before data resolves
**Expected Results**: 5 `BookingCardSkeleton` placeholders render while loading
**Business Rule**: Discovered UI behavior (`bookings/page.tsx`)
**Suggested Layer**: Component

### TC-501: Bookings list error state offers Retry
**Category**: UI State
**Priority**: P2
**Preconditions**: Simulate `/api/bookings` failing (network error or 500)
**Steps**:
1. Navigate to `/bookings`
**Expected Results**: EmptyState renders with an error message and a "Retry" button; clicking Retry calls `refetch()` and re-attempts the request
**Business Rule**: Discovered UI behavior
**Suggested Layer**: Component

### TC-502: Bookings list empty state prompts to browse events
**Category**: UI State
**Priority**: P2
**Preconditions**: User with 0 bookings
**Steps**:
1. Navigate to `/bookings`
**Expected Results**: "No bookings yet" message with a "Browse Events" CTA linking to `/events`
**Business Rule**: Discovered UI behavior
**Suggested Layer**: Component

### TC-503: "Clear All Bookings" uses a native browser confirm dialog, not a styled modal
**Category**: UI State
**Priority**: P2
**Preconditions**: User has bookings
**Steps**:
1. Click "Clear all bookings"
**Expected Results**: A native `window.confirm()` dialog appears (not the app's styled `ConfirmDialog` component used elsewhere) — automation must handle this via the browser dialog API (e.g. Playwright's `page.on('dialog', ...)`), not by querying for a modal element
**Business Rule**: Discovered UI behavior (`bookings/page.tsx`) — important for correct Playwright test authoring per `.claude/skills/playwright-best-practices`
**Suggested Layer**: E2E

### TC-504: Booking detail page distinguishes 403 "Access Denied" from generic "not found"
**Category**: UI State
**Priority**: P1
**Preconditions**: One request to a cross-user booking id (403), one request to a nonexistent id (404)
**Steps**:
1. Navigate to `/bookings/:foreign_id`
2. Separately, navigate to `/bookings/:nonexistent_id`
**Expected Results**: 403 case shows "Access Denied"; 404/other case shows generic "Booking not found" — the copy must differ, not collapse to one generic error message
**Business Rule**: Discovered UI behavior (`bookings/[id]/page.tsx`)
**Suggested Layer**: Component

### TC-505: Refund check button/spinner/result follow an idle→checking→result state machine
**Category**: UI State
**Priority**: P2
**Preconditions**: A booking detail page
**Steps**:
1. Before clicking, confirm `#check-refund-btn` visible and no spinner/result shown (idle)
2. Click it; immediately confirm `#refund-spinner` visible
3. After 4s, confirm spinner gone and `#refund-result` visible
**Expected Results**: Exactly this idle → checking → eligible/ineligible progression, no flash of incorrect intermediate state
**Business Rule**: Refund eligibility (business-rules.md #8); discovered testids
**Suggested Layer**: Component

### TC-506: Sandbox limit banner appears only on the Events page, not the Bookings page
**Category**: UI State
**Priority**: P2
**Preconditions**: Vary the user's dynamic event count from 0 up to 7, and separately vary booking count from 0 up to 9
**Steps**:
1. View `/events` at low event count (e.g. 2), then above the threshold (e.g. 6+)
2. View `/bookings` at low and high booking counts
**Expected Results**: On `/events`, the combined banner is hidden at ≤5 displayed events and appears above that threshold. On `/bookings`, no equivalent banner exists at any count — corrects an assumption in business-rules.md #5 that a conditional banner also lives on the Bookings page.
**Business Rule**: Sandbox warning banners (business-rules.md #5) — corrected per `events/page.tsx` / `bookings/page.tsx` code inspection
**Suggested Layer**: Component

### TC-507: Admin bookings table shows separate loading, empty, and error blocks
**Category**: UI State
**Priority**: P2
**Preconditions**: Simulate each of: slow load, zero bookings, and API failure on `/admin/bookings`
**Steps**:
1. Load the admin bookings page under each condition
**Expected Results**: Each condition renders its own distinct block (spinner / empty-state / error-state) rather than a shared generic fallback
**Business Rule**: Discovered UI behavior (`admin/bookings/page.tsx`)
**Suggested Layer**: Component

### TC-508: Admin "Cancel" action only rendered for confirmed bookings
**Category**: UI State
**Priority**: P2
**Preconditions**: Admin bookings table with a mix of confirmed and cancelled rows
**Steps**:
1. Inspect each row's available actions
**Expected Results**: "Cancel" button present only where `status === 'confirmed'`; cancelled rows show no cancel action
**Business Rule**: Discovered UI behavior (`admin/bookings/page.tsx`)
**Suggested Layer**: Component

### TC-509: Booking confirmation card renders in place after submit, replacing the form
**Category**: UI State
**Priority**: P1
**Preconditions**: Valid booking form filled out
**Steps**:
1. Submit "Confirm Booking"
**Expected Results**: While the request is in flight, submit button shows a loading state (`isPending`); on success, a confirmation card with the booking reference replaces the form (no page navigation required to see the ref)
**Business Rule**: User journey (business-rules.md #1)
**Suggested Layer**: Component

### TC-510: Admin events form shows a persistent "up to 6 events" reminder banner
**Category**: UI State
**Priority**: P3
**Preconditions**: Navigate to `/admin/events`
**Steps**:
1. Observe the form section regardless of current event count
**Expected Results**: The amber reminder banner ("You can add up to 6 events…") is always visible above the form, unlike the conditional Events-page banner which only shows past a count threshold
**Business Rule**: Discovered UI behavior (`admin/events/page.tsx`) — contrast with TC-116/TC-506's conditional banner
**Suggested Layer**: Component

### TC-511: Admin events table shows "Read-only" label instead of Edit/Delete for static events
**Category**: UI State
**Priority**: P2
**Preconditions**: Admin events table includes at least one static (seeded) event
**Steps**:
1. Inspect the Actions column for a static event row vs a dynamic event row
**Expected Results**: Static rows show italic "Read-only" text with a "Featured" badge next to the title and no Edit/Delete buttons; dynamic rows show functional Edit/Delete buttons
**Business Rule**: Discovered UI behavior (`admin/events/page.tsx`); static events immutable (business-rules.md #3)
**Suggested Layer**: Component

### TC-512: Event detail "Sold Out" state disables and relabels the Confirm button
**Category**: UI State
**Priority**: P1
**Preconditions**: Event with `availableSeats === 0` for this user
**Steps**:
1. Open the event detail page
**Expected Results**: Available-seats meta item shows "SOLD OUT" in red; the booking button is disabled and reads "Sold Out" instead of "Confirm Booking"
**Business Rule**: Discovered UI behavior (`events/[id]/page.tsx`)
**Suggested Layer**: Component

### TC-513: Static event detail page shows a "Featured" badge and sandbox note
**Category**: UI State
**Priority**: P3
**Preconditions**: A static (seeded) event
**Steps**:
1. Open its detail page
**Expected Results**: A green "Featured" badge appears next to the category badge, plus an inline note "This is a featured event — always available for practice"
**Business Rule**: Discovered UI behavior (`events/[id]/page.tsx`)
**Suggested Layer**: Component

### TC-514: Login page shows a demo-credential warning only for seeded demo accounts on failed login
**Category**: UI State
**Priority**: P2
**Preconditions**: Attempt login with `rahulshetty1@gmail.com` or `rahulshetty1@yahoo.com` using a wrong password; separately attempt with any other unrelated email and wrong password
**Steps**:
1. Submit login for the demo email with an incorrect password
2. Submit login for a non-demo email with an incorrect password
**Expected Results**: Demo email case shows the amber "Looks like you're using sample test credentials!" nudge with a link to `/register`; non-demo case shows a generic error toast instead
**Business Rule**: Discovered UI behavior (`login/page.tsx` `DEMO_EMAILS`)
**Suggested Layer**: Component

### TC-515: Login page's external "Explore" links are conditionally rendered based on a config flag
**Category**: UI State
**Priority**: P3
**Preconditions**: Backend `SHOW_EXPLORE_LINKS` env flag toggled true/false, reflected via `GET /api/config`
**Steps**:
1. Load `/login` with the flag true, then with it false
**Expected Results**: The "Explore all courses" / "Explore Skill Assessments" CTA links render only when `showExploreLinks` is true in the fetched config
**Business Rule**: `backend/.env` `SHOW_EXPLORE_LINKS` feature flag (CLAUDE.md); discovered UI behavior (`login/page.tsx`)
**Suggested Layer**: Component

### TC-516: Register page's password-requirement checklist updates live as the user types
**Category**: UI State
**Priority**: P2
**Preconditions**: On `/register`
**Steps**:
1. Type a password incrementally, satisfying each of the 4 rules one at a time (length, uppercase, number, symbol)
**Expected Results**: Each checklist item flips from gray/unchecked to green/checked the moment its condition is met, independently of the others and without requiring form submission
**Business Rule**: Discovered UI behavior (`register/page.tsx` `PASSWORD_RULES`)
**Suggested Layer**: Component

### TC-517: Events list shows 12 skeleton cards while loading
**Category**: UI State
**Priority**: P3
**Preconditions**: Simulate a slow `/api/events` response
**Steps**:
1. Navigate to `/events` and observe before data resolves
**Expected Results**: 12 `EventCardSkeleton` placeholders render in the grid, matching the page size
**Business Rule**: Discovered UI behavior (`events/page.tsx`)
**Suggested Layer**: Component

### TC-518: Events list shows an empty state with filter guidance when no results match
**Category**: UI State
**Priority**: P2
**Preconditions**: Apply a filter combination guaranteed to match zero events
**Steps**:
1. Search/filter to zero results
**Expected Results**: "No events found — Try adjusting your filters or search terms" empty state renders instead of an empty grid
**Business Rule**: Discovered UI behavior (`events/page.tsx`)
**Suggested Layer**: Component

### TC-519: Pagination controls are hidden when there is only one page of results
**Category**: UI State
**Priority**: P3
**Preconditions**: Filtered/total result set fits within a single page (e.g. ≤10 admin events, ≤12 events, ≤15 admin bookings)
**Steps**:
1. Load `/admin/events` and `/admin/bookings` with `totalPages === 1`
**Expected Results**: The `Pagination` control is not rendered at all (admin pages explicitly gate on `pagination.totalPages > 1`)
**Business Rule**: Discovered UI behavior (`admin/events/page.tsx`, `admin/bookings/page.tsx`)
**Suggested Layer**: Component
