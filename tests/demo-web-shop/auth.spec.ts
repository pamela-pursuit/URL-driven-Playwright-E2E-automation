import { expect, test } from '../../fixtures/demo-web-shop.fixture';
import { INVALID, MESSAGES, unknownEmail, wrongLoginValue } from '../../test-data/demo-web-shop.data';

// P9: account values must not reach report artifacts. Values are filled without step titles
// (fillAccountValue); a trace would still record evaluate arguments and signed-in DOM snapshots,
// so tracing is off for this file (trace is worker-scoped, so it cannot be set per describe).
test.use({ trace: 'off' });

test.describe('Authentication', () => {
  test.describe('Existing account', () => {
    test('[TC-01] Registered customer signs in with valid credentials', async ({ signInAsExistingUser, header, existingUser, page }) => {
      await test.step('Sign in as existingUser on /login', async () => {
        await signInAsExistingUser();
      });

      await expect(page).toHaveURL(/\/$/);
      expect(await header.accountLinkShows(existingUser.email), 'header account link shows the existingUser email').toBe(true);
      await expect(header.logoutLink).toBeVisible();
      await expect(header.loginLink).toHaveCount(0);
      await expect(header.registerLink).toHaveCount(0);
    });
  });

  test('[TC-03] Unknown email is rejected without revealing that the account does not exist', async ({ loginPage, header, page }) => {
    await loginPage.open();
    const outcome = await loginPage.signIn(unknownEmail(), wrongLoginValue());

    expect(outcome).toBe('rejected');
    await expect(page).toHaveURL(/\/login$/);
    await expect(loginPage.errorSummary).toContainText(MESSAGES.loginFailed);
    await expect(header.loginLink).toBeVisible();
    // Defect DEF-001: this check fails until the defect is fixed (the summary says "No customer account found" (account enumeration).).
    await expect(loginPage.errorSummary, 'DEF-001: the message does not reveal whether the email is registered')
      .not.toContainText(MESSAGES.noCustomerAccount, { timeout: 2_000 });
  });

  test('[TC-04] Login with both fields empty shows the server summary', async ({ loginPage, page }) => {
    await loginPage.open();
    await loginPage.submitEmpty();

    await expect(page).toHaveURL(/\/login$/);
    await expect(loginPage.errorSummary).toContainText(MESSAGES.loginFailed);
    await expect(loginPage.errorSummary).toContainText(MESSAGES.noCustomerAccount);
    await expect(loginPage.emailFieldError).toHaveCount(0);
  });

  test('[TC-05] Malformed email is flagged client-side', async ({ loginPage, page }) => {
    await loginPage.open();
    await loginPage.enterEmailAndBlur(INVALID.loginEmail);
    await expect(loginPage.emailFieldError).toHaveText(MESSAGES.invalidEmailLogin);

    // Client-side validation blocks the submit: no navigation, no server summary.
    await loginPage.loginButton.click();
    await expect(loginPage.emailFieldError).toHaveText(MESSAGES.invalidEmailLogin);
    await expect(loginPage.errorSummary).toHaveCount(0);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('[TC-06] Whitespace-only email does not sign the user in', async ({ loginPage, header, page }) => {
    await loginPage.open();
    const outcome = await loginPage.signIn(INVALID.whitespaceEmail, wrongLoginValue());

    // R-17 (closed): observed on the first run, now asserted.
    expect(outcome).toBe('rejected');
    await expect(page).toHaveURL(/\/login$/);
    await expect(header.logoutLink).toHaveCount(0);
    await expect(loginPage.errorSummary).toContainText(MESSAGES.loginFailed);
    await expect(loginPage.errorSummary).toContainText(MESSAGES.noCustomerAccount);
  });

  // Wrong password on the shared account (user decision 2026-11-11): one attempt per browser, never retried,
  // and run LAST in its own pass (tag @runs-last) so a possible lockout cannot affect the other signed-in tests.
  test.describe('Wrong password for the existing account', () => {
    test.describe.configure({ retries: 0 });
    test('[TC-02] Known email with a wrong password is rejected', { tag: '@runs-last' }, async ({ loginPage, header, existingUser, loginCircuitBreaker, page }) => {
      // Do not add a further rejected attempt if existingUser was already rejected in this run.
      loginCircuitBreaker.ensureClosed();
      await loginPage.open();
      const outcome = await loginPage.signIn(existingUser.email, wrongLoginValue());

      expect(outcome).toBe('rejected');
      await expect(page).toHaveURL(/\/login$/);
      await expect(loginPage.errorSummary).toContainText(MESSAGES.loginFailed);
      await expect(loginPage.errorSummary).toContainText(MESSAGES.credentialsIncorrect);
      await expect(header.loginLink).toBeVisible();
      await expect(header.registerLink).toBeVisible();
    });
  });
});
