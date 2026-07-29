# Booking Management Test Scenarios

## Happy Path Scenarios (TC-001-099)

### TC-001: User Books Single Ticket Successfully
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in, static event "Tech Conference Bangalore" exists with available seats
**Steps**:
1. Navigate to /events
2. Click "Book Now" on Tech Conference Bangalore event card
3. Verify ticket quantity is 1 (default)
4. Enter customer name: "John Doe"
5. Enter customer email: "john.doe@test.com"
6. Enter customer phone: "9876543210"
7. Click "Confirm Booking"
**Expected Results**:
- Confirmation card displays with unique booking reference (format: T-XXXXXX)
- Booking reference first letter matches event title (T for "Tech Conference")
- Booking appears in /bookings list
- Event available seats decremented by 1
**Business Rule**: Booking reference format validation, seat decrement
**Suggested Layer**: E2E

### TC-002: User Books Multiple Tickets (Quantity > 1)
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in, static event with 100+ available seats
**Steps**:
1. Navigate to /events/:id for any event
2. Click "+" button 4 times to set quantity to 5
3. Fill customer form (name, email, phone)
4. Click "Confirm Booking"
**Expected Results**:
- Booking created with quantity = 5
- Total price = event.price × 5
- Available seats reduced by 5
- Booking displays in list with quantity visible
**Business Rule**: Per-ticket pricing, seat decrement for multi-ticket bookings
**Suggested Layer**: E2E

### TC-003: User Views Booking Details
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User has at least one confirmed booking
**Steps**:
1. Navigate to /bookings
2. Click "View Details" on any booking
3. Verify all booking info displays (ref, event, customer name, email, phone, quantity, total price)
**Expected Results**:
- Booking detail page loads with correct data
- Event linked event details visible
- Booking reference clearly displayed
- All customer data matches original input
**Suggested Layer**: E2E

### TC-004: User Cancels Single Booking
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User has at least one booking
**Steps**:
1. Navigate to /bookings/:id
2. Click "Cancel Booking" button
3. Confirm cancellation (if modal appears)
**Expected Results**:
- Booking is deleted
- User is redirected to /bookings
- Booking no longer appears in the list
- Available seats for that event are restored
**Business Rule**: Booking deletion, seat restoration
**Suggested Layer**: E2E

### TC-005: User Clears All Bookings
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User has multiple (3+) bookings
**Steps**:
1. Navigate to /bookings
2. Locate "Clear All Bookings" button/link
3. Click it
4. Confirm deletion if prompted
**Expected Results**:
- All bookings are deleted in a single operation
- Page shows empty state with message "No bookings found"
- All seat counts are restored for affected events
**Business Rule**: Bulk booking deletion
**Suggested Layer**: E2E

### TC-006: Check Refund Eligibility - Single Ticket (Eligible)
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User has a booking with quantity = 1
**Steps**:
1. Navigate to /bookings/:id for single-ticket booking
2. Click "Check Refund Eligibility" button
3. Wait for spinner to complete (4 seconds)
**Expected Results**:
- Spinner displays for approximately 4 seconds
- Result message: "Single-ticket bookings qualify for a full refund"
- Button becomes disabled or changes state
**Business Rule**: Refund eligibility for single-ticket bookings
**Suggested Layer**: E2E

### TC-007: Check Refund Eligibility - Multi-Ticket (Ineligible)
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User has a booking with quantity > 1 (e.g., 3 tickets)
**Steps**:
1. Navigate to /bookings/:id for multi-ticket booking
2. Click "Check Refund Eligibility" button
3. Wait for spinner to complete
**Expected Results**:
- Spinner displays for 4 seconds
- Result message: "Group bookings (N tickets) are non-refundable" where N = quantity
- Button state updates
**Business Rule**: Refund ineligibility for group bookings
**Suggested Layer**: E2E

### TC-008: Book Event, Navigate to Bookings, Confirm Persistence
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User is logged in with no prior bookings
**Steps**:
1. Book an event (quantity 2, all customer details filled)
2. Confirm booking and note reference
3. Navigate away (Browse Events)
4. Navigate back to /bookings
**Expected Results**:
- Booking persists in the bookings list
- All details match original booking
- Booking reference is identical
**Business Rule**: Data persistence
**Suggested Layer**: E2E

---

## Business Rule Scenarios (TC-100-199)

### TC-100: Booking Quantity Affects Total Price Correctly
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Static event "Bollywood Night Mumbai" priced at $999
**Steps**:
1. Navigate to /events/:id
2. Set quantity to 3
3. Fill and submit booking form
**Expected Results**:
- Confirmation card shows Total Price = 999 × 3 = $2997
- Booking saved with totalPrice = $2997
- GET /api/bookings/:id returns totalPrice: 2997
**Business Rule**: totalPrice = event.price × quantity
**Suggested Layer**: API

### TC-101: Booking Reference First Letter Matches Event Title
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User creates bookings for multiple different events
**Steps**:
1. Book "Tech Conference Bangalore" (title starts with T)
2. Note booking reference (should start with T)
3. Book "Bollywood Night Mumbai" (title starts with B)
4. Note booking reference (should start with B)
5. Book "IPL Cricket Finals" (title starts with I)
6. Note booking reference (should start with I)
**Expected Results**:
- First booking reference: T-XXXXXX
- Second booking reference: B-XXXXXX
- Third booking reference: I-XXXXXX
**Business Rule**: Booking reference first letter derived from event title
**Suggested Layer**: API, E2E

### TC-102: User Can Book Same Event Multiple Times (Sandbox Isolation)
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has booked an event once, seats are still available
**Steps**:
1. Navigate to /events/:id (same event as previous booking)
2. Book again with quantity 1, different customer email
3. Verify second booking succeeds
**Expected Results**:
- Second booking created successfully
- Both bookings appear in user's /bookings list
- Seat count reduced by 1 again (cumulative reduction)
**Business Rule**: Per-user seat availability allows multiple bookings by same user
**Suggested Layer**: E2E

### TC-103: Booking FIFO Limit - Max 9 Bookings Per User
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User needs to have exactly 9 bookings already
**Steps**:
1. Verify user has 9 bookings via GET /api/bookings
2. Create a 10th booking
3. Verify the new booking is created
4. Check /api/bookings to count total bookings
**Expected Results**:
- New (10th) booking is created successfully
- Oldest booking (1st) is automatically deleted (FIFO)
- Total bookings remain at 9 (max limit enforced)
- The 2nd-9th bookings and new booking exist
**Business Rule**: Max 9 bookings per user, FIFO replacement
**Suggested Layer**: API

### TC-104: Booking Deletion Restores Available Seats
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Event has X available seats, user has a booking for Q tickets
**Steps**:
1. Record available seats before deletion (GET /api/events/:id)
2. Delete booking
3. Get event details again
**Expected Results**:
- Available seats increased by Q after deletion
- Seat count reflects available = (original - other users' bookings)
**Business Rule**: Booking deletion immediately frees seats
**Suggested Layer**: API

### TC-105: Booking Page Displays Max 9 Bookings Per Load (Pagination)
**Category**: Business Rule
**Priority**: P2
**Preconditions**: User has 15+ bookings
**Steps**:
1. Navigate to /bookings
2. Count visible booking cards on page
3. Check for pagination controls or "Load More"
**Expected Results**:
- First page shows max 9 bookings
- Pagination controls visible (if 10+ total)
- Clicking next page shows remaining bookings
**Business Rule**: Bookings page pagination limit of 9
**Suggested Layer**: E2E

### TC-106: Sandbox Banner Appears on Bookings Page When Close to Limit
**Category**: Business Rule
**Priority**: P2
**Preconditions**: User has 7-9 bookings
**Steps**:
1. Navigate to /bookings
2. Look for warning banner about sandbox limits
**Expected Results**:
- Banner visible with message "sandbox holds up to 6 events and 9 bookings"
- Banner alerts user to impending FIFO deletion
**Business Rule**: Sandbox awareness warning
**Suggested Layer**: E2E

---

## Security Scenarios (TC-200-299)

### TC-200: Cross-User Booking Access Denied (403)
**Category**: Security
**Priority**: P0
**Preconditions**: User A has a booking; User B is logged in
**Steps**:
1. User A creates a booking and note its ID
2. User B logs in (or switch account)
3. User B navigates to /bookings/:userA_booking_id
**Expected Results**:
- Page displays "Access Denied" or 403 error
- User B cannot view User A's booking details
- User B cannot see the booking reference, customer name, or any booking info
**Business Rule**: Cross-user access control
**Suggested Layer**: E2E

### TC-201: Unauthenticated User Cannot Access /bookings
**Category**: Security
**Priority**: P0
**Preconditions**: User is not logged in
**Steps**:
1. Clear authentication token (logout or clear localStorage)
2. Navigate directly to /bookings
**Expected Results**:
- User is redirected to /login
- Page does not display any bookings
**Business Rule**: Authentication required for bookings page
**Suggested Layer**: E2E

### TC-202: Invalid Token Rejection on Booking Access
**Category**: Security
**Priority**: P1
**Preconditions**: User has a valid booking; token is manually corrupted
**Steps**:
1. Open browser DevTools
2. Navigate to /bookings
3. In Application/Storage, modify the JWT token (change one character)
4. Refresh page
**Expected Results**:
- 401 Unauthorized error
- User redirected to /login
- No booking data exposed
**Business Rule**: Invalid token rejection
**Suggested Layer**: E2E

### TC-203: User Cannot Delete Another User's Booking (API)
**Category**: Security
**Priority**: P0
**Preconditions**: User A has a booking (ID = 42); User B is authenticated
**Steps**:
1. User A books an event (record booking ID)
2. User B logs in
3. User B makes DELETE /api/bookings/42 request with User B's token
**Expected Results**:
- 403 Forbidden response
- Booking is NOT deleted
- User A's booking still exists
**Business Rule**: Authorization check on booking deletion
**Suggested Layer**: API

### TC-204: Missing Authorization Header Returns 401
**Category**: Security
**Priority**: P1
**Preconditions**: An endpoint requires authentication
**Steps**:
1. Make POST /api/bookings request WITHOUT Bearer token
2. Do NOT include Authorization header
**Expected Results**:
- 401 Unauthorized response
- Error message: "Unauthorized" or "Missing token"
- Booking is NOT created
**Business Rule**: Bearer token requirement
**Suggested Layer**: API

---

## Negative/Error Scenarios (TC-300-399)

### TC-300: Insufficient Seats Error
**Category**: Negative
**Priority**: P0
**Preconditions**: Event has only 2 available seats; User A booked 1 ticket
**Steps**:
1. User B navigates to /events/:id
2. Set quantity to 3
3. Attempt to confirm booking
**Expected Results**:
- Toast/alert: "Insufficient seats available" or similar
- Booking is NOT created
- Available seats remain at 2
**Business Rule**: Seat availability validation
**Suggested Layer**: E2E, API

### TC-301: Missing Customer Name in Booking Form
**Category**: Negative
**Priority**: P1
**Preconditions**: User is on booking form page
**Steps**:
1. Leave "Full Name" field empty
2. Fill email and phone fields
3. Click "Confirm Booking"
**Expected Results**:
- Validation error displayed: "Full Name is required" or similar
- Booking form remains on page (not submitted)
- No booking created
**Business Rule**: Required field validation
**Suggested Layer**: E2E

### TC-302: Invalid Email Format in Booking Form
**Category**: Negative
**Priority**: P1
**Preconditions**: User is on booking form
**Steps**:
1. Enter customer name: "Jane Doe"
2. Enter invalid email: "notanemail"
3. Enter valid phone: "9876543210"
4. Click "Confirm Booking"
**Expected Results**:
- Validation error: "Invalid email format" or "Enter a valid email"
- Booking not submitted
**Business Rule**: Email validation
**Suggested Layer**: E2E

### TC-303: Invalid Phone Number (Less Than 10 Digits)
**Category**: Negative
**Priority**: P1
**Preconditions**: User is on booking form
**Steps**:
1. Fill name and email correctly
2. Enter phone: "98765" (5 digits)
3. Click "Confirm Booking"
**Expected Results**:
- Validation error: "Phone number must be at least 10 digits"
- Booking not created
**Business Rule**: Phone number validation (min 10 digits)
**Suggested Layer**: E2E

### TC-304: Quantity Below Minimum (0 or Negative)
**Category**: Negative
**Priority**: P1
**Preconditions**: User is on event booking page
**Steps**:
1. Click "-" button repeatedly to set quantity to 0
2. Attempt to confirm booking
**Expected Results**:
- Quantity cannot go below 1 (button disabled or minimum enforced)
- Confirm button disabled if quantity < 1
- No booking created if somehow submitted
**Business Rule**: Minimum quantity = 1
**Suggested Layer**: E2E

### TC-305: Quantity Above Maximum (> 10)
**Category**: Negative
**Priority**: P1
**Preconditions**: User is on event booking page
**Steps**:
1. Click "+" button repeatedly to attempt to set quantity > 10
2. Try to confirm booking
**Expected Results**:
- Quantity is capped at 10 (button disabled or max enforced)
- Cannot confirm booking with quantity > 10
**Business Rule**: Maximum quantity = 10
**Suggested Layer**: E2E

### TC-306: Cancel Booking on Non-Existent Booking ID
**Category**: Negative
**Priority**: P2
**Preconditions**: Booking ID 99999 does not exist
**Steps**:
1. Navigate to /bookings/99999 directly
**Expected Results**:
- 404 Not Found or "Booking not found" message
- No booking data displayed
**Business Rule**: Error handling for missing bookings
**Suggested Layer**: E2E

### TC-307: Duplicate Booking in Rapid Succession
**Category**: Negative
**Priority**: P2
**Preconditions**: User is on booking form with all fields filled
**Steps**:
1. Click "Confirm Booking" button
2. Immediately click "Confirm Booking" button again (double-click)
**Expected Results**:
- Only ONE booking created (idempotency or button disabled after first click)
- No duplicate booking created
- Available seats decremented only once
**Business Rule**: Idempotency / request debouncing
**Suggested Layer**: E2E

---

## Edge Case Scenarios (TC-400-499)

### TC-400: Book Last Available Seat(s)
**Category**: Edge Case
**Priority**: P1
**Preconditions**: Event has exactly 3 available seats
**Steps**:
1. User A books 2 tickets
2. User B books 1 ticket
3. User C attempts to book 1 ticket
**Expected Results**:
- User A and B bookings succeed
- User C sees "Insufficient seats available" error
- Total booked = 3 (event fully booked)
**Business Rule**: Boundary condition for seat availability
**Suggested Layer**: E2E

### TC-401: Book After Previous Booking Canceled
**Category**: Edge Case
**Priority**: P1
**Preconditions**: Event is fully booked; User A has a booking for Q tickets
**Steps**:
1. Verify event has 0 available seats
2. User A cancels their booking (Q tickets freed)
3. User B attempts to book Q tickets
**Expected Results**:
- User B's booking succeeds (seats restored and re-allocated)
- Event seats remain consistent
**Business Rule**: Seat restoration and re-allocation
**Suggested Layer**: E2E

### TC-402: Customer Name with Special Characters
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User is on booking form
**Steps**:
1. Enter customer name: "Jean-Pierre O'Neill Müller"
2. Fill email and phone
3. Confirm booking
**Expected Results**:
- Booking created successfully
- Customer name saved exactly as entered (with special chars)
- Name displayed correctly on booking detail page
**Business Rule**: Accept Unicode and special characters in customer name
**Suggested Layer**: E2E

### TC-403: Booking with Email Containing Multiple Domains
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User is on booking form
**Steps**:
1. Enter customer email: "test@subdomain.example.co.uk"
2. Fill name and phone
3. Confirm booking
**Expected Results**:
- Email accepted as valid
- Booking created successfully
- Email stored correctly
**Business Rule**: Email validation accepts standard formats
**Suggested Layer**: E2E

### TC-404: Phone Number with International Format
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User is on booking form
**Steps**:
1. Enter phone: "+91 9876543210" (with country code and spaces)
2. Fill name and email
3. Confirm booking
**Expected Results**:
- Phone accepted (if validator accepts formatted input)
- Booking created successfully
- Phone stored as provided or normalized
**Business Rule**: Phone number parsing flexibility
**Suggested Layer**: E2E

### TC-405: Booking Reference Uniqueness Across Multiple Bookings
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User creates 5 bookings
**Steps**:
1. Create booking 1 and note reference (T-XXXXXX)
2. Create booking 2 and note reference (T-YYYYYY)
3. Create booking 3, 4, 5 and collect all references
4. Verify all 5 references are unique
**Expected Results**:
- All 5 booking references are unique
- No duplicates despite collision probability
**Business Rule**: Booking reference collision avoidance
**Suggested Layer**: API

### TC-406: Cancel Booking Immediately Before FIFO Limit Hit
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has 8 bookings; creates 9th to hit max
**Steps**:
1. Verify user has 9 bookings (at limit)
2. Create a 10th booking (oldest = #1 is auto-deleted)
3. Immediately cancel the 10th booking
4. Verify state consistency
**Expected Results**:
- 9 bookings remain (10th canceled, oldest was FIFO-deleted)
- No booking count inconsistency
- Seat counts are consistent
**Business Rule**: FIFO replacement + cancellation state consistency
**Suggested Layer**: API

### TC-407: Booking for Static Event Cannot Be "Edited" (Via API)
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has a booking for a static event
**Steps**:
1. Attempt to call PUT /api/bookings/:id with updated quantity
**Expected Results**:
- 400 Bad Request or 403 Forbidden (bookings immutable)
- Booking quantity unchanged
**Business Rule**: Bookings are immutable (cancellation only)
**Suggested Layer**: API

### TC-408: Extremely Long Customer Name
**Category**: Edge Case
**Priority**: P3
**Preconditions**: User is on booking form
**Steps**:
1. Enter customer name with 100+ characters
2. Fill email and phone
3. Confirm booking
**Expected Results**:
- Either accepted with truncation or rejected with length validation
- Behavior should be consistent and documented
**Business Rule**: Customer name length constraints
**Suggested Layer**: E2E

---

## UI State Scenarios (TC-500-599)

### TC-500: Booking Confirmation Card Layout
**Category**: UI State
**Priority**: P2
**Preconditions**: User has just completed a booking
**Steps**:
1. On confirmation card, verify all elements present:
   - Booking reference (bold, monospace)
   - Event title
   - Customer name
   - Quantity
   - Total price
   - Action buttons ("View My Bookings", "Browse Events")
**Expected Results**:
- All elements visible and properly formatted
- Booking reference prominently displayed
- Data matches submitted values
**Suggested Layer**: E2E

### TC-501: Empty Bookings Page State
**Category**: UI State
**Priority**: P2
**Preconditions**: User has no bookings
**Steps**:
1. Navigate to /bookings
**Expected Results**:
- "No bookings found" or empty state message displayed
- No booking cards visible
- Action button "Browse Events" or "Book Now" available
- "Clear All Bookings" button hidden or disabled
**Suggested Layer**: E2E

### TC-502: Bookings List with Mixed Quantities Display
**Category**: UI State
**Priority**: P2
**Preconditions**: User has bookings with quantities 1, 3, and 5
**Steps**:
1. Navigate to /bookings
2. Inspect each booking card
**Expected Results**:
- Each card clearly shows quantity (e.g., "Quantity: 3")
- Prices reflect per-ticket × quantity calculation
- Cards are visually distinct and scannable
**Suggested Layer**: E2E

### TC-503: Booking Reference Display (Format Validation)
**Category**: UI State
**Priority**: P2
**Preconditions**: User views a booking detail page
**Steps**:
1. Locate booking reference element
2. Inspect formatting (should be monospace, bold)
**Expected Results**:
- Reference displayed in clear, readable format
- Font is monospace (e.g., Courier, Monaco)
- Bold or high contrast styling
- Format is `[LETTER]-[6_CHARS]` e.g., "T-A3B2C1"
**Suggested Layer**: E2E

### TC-504: Refund Eligibility Button States
**Category**: UI State
**Priority**: P2
**Preconditions**: User views a booking detail page
**Steps**:
1. On single-ticket booking, check button before clicking
2. Click "Check Refund Eligibility"
3. Observe button state during spinner (4 seconds)
4. Observe button state after result displays
**Expected Results**:
- Button enabled initially
- Button may be disabled during spinner animation
- Button disabled or removed after result displays
- Spinner visible for ~4 seconds
- Result message appears after spinner completes
**Suggested Layer**: E2E

### TC-505: Pagination Controls on Bookings Page
**Category**: UI State
**Priority**: P2
**Preconditions**: User has 15+ bookings
**Steps**:
1. Navigate to /bookings
2. Verify pagination UI present (prev, next, page number)
3. Click "Next" to go to page 2
4. Verify page 2 loads with different bookings
**Expected Results**:
- Pagination controls visible and functional
- First page shows bookings 1-9
- Second page shows bookings 10-15 (or similar)
- Previous/Next buttons enable/disable appropriately
**Suggested Layer**: E2E

### TC-506: Cancel Booking Button Visibility
**Category**: UI State
**Priority**: P2
**Preconditions**: User is viewing a booking detail page
**Steps**:
1. Scroll to bottom of booking detail page
2. Locate "Cancel Booking" button
**Expected Results**:
- Button is visible and clickable
- Button has warning styling (red or prominent)
- May have confirmation modal after click
**Suggested Layer**: E2E

### TC-507: Sandbox Warning Banner Position and Visibility
**Category**: UI State
**Priority**: P2
**Preconditions**: User has 7+ bookings
**Steps**:
1. Navigate to /bookings
2. Look for sandbox warning banner
3. Verify banner content and styling
**Expected Results**:
- Banner displayed at top of page
- Text: "sandbox holds up to 6 events and 9 bookings"
- Warning styling (yellow/orange background, visible)
- Banner dismissible or auto-hides when scrolling (optional)
**Suggested Layer**: E2E

### TC-508: "Clear All Bookings" Button Visibility Rules
**Category**: UI State
**Priority**: P2
**Preconditions**: User has bookings (at least 1)
**Steps**:
1. Navigate to /bookings
2. Count visible bookings
3. Check for "Clear All Bookings" button
**Expected Results**:
- Button visible when bookings exist
- Button text clear: "Clear All Bookings" or similar
- Button may have warning/danger styling
- Button hidden when user has 0 bookings
**Suggested Layer**: E2E

### TC-509: Responsive Design - Booking Card on Mobile
**Category**: UI State
**Priority**: P2
**Preconditions**: User views /bookings on mobile viewport (375px width)
**Steps**:
1. Open /bookings on mobile device or browser viewport
2. Verify booking card layout
3. Check if all text is readable
4. Verify buttons are tappable (min 44px height)
**Expected Results**:
- Card layout responsive and readable
- No horizontal scroll needed
- Text font size readable on small screen
- Buttons have adequate touch target size
- "View Details" link is clearly tappable
**Suggested Layer**: E2E

### TC-510: Booking Detail Page Loading State
**Category**: UI State
**Priority**: P2
**Preconditions**: User navigates to /bookings/:id
**Steps**:
1. Navigate to /bookings/:id
2. Observe page during initial load
**Expected Results**:
- Loading spinner visible (if async data fetch)
- After load, booking details appear
- No layout shift after data loads
- Page is interactive after load completes
**Suggested Layer**: E2E

### TC-511: Total Price Formatting
**Category**: UI State
**Priority**: P2
**Preconditions**: User views a booking with total price $2997.50
**Steps**:
1. Navigate to booking detail page
2. Locate total price display
3. Verify formatting
**Expected Results**:
- Price displayed as "$2997.50" or "2997.50 USD"
- Currency symbol present
- Decimal places consistent (2 decimals)
- No ambiguous formatting
**Suggested Layer**: E2E

### TC-512: Customer Details Section Organization
**Category**: UI State
**Priority**: P2
**Preconditions**: User views booking detail page
**Steps**:
1. Verify layout includes:
   - Customer name clearly labeled
   - Email clearly labeled
   - Phone clearly labeled
   - All values visible and readable
**Expected Results**:
- Information is well-organized and scannable
- Labels are distinct from values
- Data matches submitted booking form
- Layout is consistent across devices
**Suggested Layer**: E2E

