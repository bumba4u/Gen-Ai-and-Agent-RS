import { test, expect } from '@playwright/test';

// No playwright.config.js exists in this repo (see CLAUDE.md) — BASE_URL is
// hardcoded per-file, matching the pattern in tests/booking-management.spec.js.
const BASE_URL      = 'https://eventhub.rahulshettyacademy.com';
const USER_EMAIL    = 'rahulshetty1@gmail.com';
const USER_PASSWORD = 'Magiclife1!';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('you@email.com').fill(USER_EMAIL);
  await page.getByLabel('Password').fill(USER_PASSWORD);
  await page.locator('#login-btn').click();
  // Home page loads after login — "Browse Events →" link confirms successful auth
  await expect(page.getByRole('link', { name: /Browse Events/i }).first()).toBeVisible();
}

/**
 * Clears all bookings so each test starts from a known (empty) state.
 * Safe to call when already empty.
 */
async function clearBookings(page) {
  await page.goto(`${BASE_URL}/bookings`);
  const alreadyEmpty = await page.getByText('No bookings yet').isVisible().catch(() => false);
  if (alreadyEmpty) return;

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /clear all bookings/i }).click();
  await expect(page.getByText('No bookings yet')).toBeVisible();
}

/**
 * Books the first available (non-sold-out) event on the events page with quantity 1.
 * Returns { bookingRef, eventTitle } read from the confirmation card.
 * Precondition: user must already be logged in.
 */
async function bookFirstAvailableEvent(page) {
  await page.goto(`${BASE_URL}/events`);

  const firstCard = page.getByTestId('event-card').filter({
    has: page.getByTestId('book-now-btn'),
  }).first();
  await expect(firstCard).toBeVisible();

  const eventTitle = (await firstCard.locator('h3').textContent())?.trim() ?? '';
  console.log(`Booking event: "${eventTitle}"`);

  await firstCard.getByTestId('book-now-btn').click();
  await expect(page).toHaveURL(/\/events\/\d+/);

  await page.getByLabel('Full Name').fill('Test User');
  await page.getByTestId('customer-email').fill('testuser@example.com');
  await page.getByPlaceholder('+91 98765 43210').fill('9876543210');
  await page.locator('#confirm-booking').click();

  const refEl = page.locator('.booking-ref').first();
  await expect(refEl).toBeVisible();
  const bookingRef = (await refEl.textContent())?.trim() ?? '';
  console.log(`Booking confirmed. Ref: ${bookingRef}`);

  return { bookingRef, eventTitle };
}

// ── Test Suite ─────────────────────────────────────────────────────────────────
// Layer/scope per docs/test-strategy.md "Happy Path" + "E2E" sections.

test.describe('Booking Flow — Critical E2E Journeys', () => {

  // TC-013 + TC-015 + TC-016 (chained, per test-strategy.md: "as one chained
  // journey" to avoid repeating login/booking setup for each) ────────────────
  test('TC-013/015/016: books a single ticket, then views it in the list and on the detail page', async ({ page }) => {
    // -- Step 1: Login and start from a clean slate --
    await login(page);
    await clearBookings(page);

    // -- Step 2: Book a single ticket for the first available event (TC-013) --
    const { bookingRef, eventTitle } = await bookFirstAvailableEvent(page);

    // -- Step 3: Navigate to /bookings and verify the new booking is listed (TC-015) --
    await page.goto(`${BASE_URL}/bookings`);
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await expect(card).toBeVisible();
    await expect(card).toContainText(eventTitle);
    await expect(card).toContainText('confirmed');
    await expect(card).toContainText('1 ticket');

    // -- Step 4: Click "View Details" and verify the detail page (TC-016) --
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    await expect(page.locator('span.font-mono.font-bold').first()).toContainText(bookingRef);
    await expect(page.getByRole('heading', { name: eventTitle })).toBeVisible();

    await expect(page.getByText('Event Details')).toBeVisible();
    await expect(page.getByText('Customer Details')).toBeVisible();
    await expect(page.getByText('Test User')).toBeVisible();
    await expect(page.getByText('testuser@example.com')).toBeVisible();

    await expect(page.getByText('Payment Summary')).toBeVisible();
    await expect(page.getByText('Total Paid')).toBeVisible();

    // Refund check entry point should be present (business-rules.md #8)
    await expect(page.getByTestId('check-refund-btn')).toBeVisible();
  });

  // TC-019 ───────────────────────────────────────────────────────────────────
  test('TC-019: cancels a booking from the detail page via the styled confirm dialog', async ({ page }) => {
    // -- Step 1: Login, clear state, create one booking --
    await login(page);
    await clearBookings(page);
    const { bookingRef } = await bookFirstAvailableEvent(page);

    // -- Step 2: Navigate to the booking's detail page --
    await page.goto(`${BASE_URL}/bookings`);
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // -- Step 3: Click "Cancel Booking" and confirm the styled ConfirmDialog appears --
    await page.getByRole('button', { name: 'Cancel Booking' }).click();
    await expect(page.getByText('Cancel this booking?')).toBeVisible();
    await expect(page.getByText(`Cancelling ${bookingRef} will release`)).toBeVisible();

    // -- Step 4: Confirm cancellation --
    await page.getByTestId('confirm-dialog-yes').click();

    // -- Step 5: Assert redirect to /bookings and success toast --
    await expect(page).toHaveURL(`${BASE_URL}/bookings`);
    await expect(page.getByText('Booking cancelled successfully')).toBeVisible();

    // -- Step 6: Assert the booking no longer appears (seats freed per business-rules.md #4) --
    await expect(page.getByTestId('booking-card').filter({ hasText: bookingRef })).not.toBeVisible();
  });

  // TC-020 + TC-503 (native browser confirm dialog, not the styled ConfirmDialog
  // used elsewhere — see test-strategy.md UI State section) ──────────────────
  test('TC-020/503: clears all bookings via the native browser confirm dialog', async ({ page }) => {
    // -- Step 1: Login, clear state, create two bookings --
    await login(page);
    await clearBookings(page);
    await bookFirstAvailableEvent(page);
    await bookFirstAvailableEvent(page);

    // -- Step 2: Navigate to /bookings and verify bookings exist --
    await page.goto(`${BASE_URL}/bookings`);
    await expect(page.getByTestId('booking-card').first()).toBeVisible();
    const cardCountBefore = await page.getByTestId('booking-card').count();
    expect(cardCountBefore).toBeGreaterThanOrEqual(2);

    // -- Step 3: Click "Clear all bookings" and assert the NATIVE confirm() dialog fires --
    // Native dialogs block the page's JS thread, so the handler must be registered
    // *before* the click — awaiting a separate waitForEvent() after click() would hang.
    let capturedDialog;
    page.once('dialog', (dialog) => {
      capturedDialog = { type: dialog.type(), message: dialog.message() };
      dialog.accept();
    });
    await page.getByRole('button', { name: /clear all bookings/i }).click();
    expect(capturedDialog?.type).toBe('confirm');
    expect(capturedDialog?.message).toBe('Clear all your bookings? This cannot be undone.');

    // -- Step 4: Assert empty state --
    await expect(page.getByText('No bookings yet')).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Browse Events' })).toBeVisible();
  });

});
