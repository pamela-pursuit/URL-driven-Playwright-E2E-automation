import { expect, recordObservation, sessionCookieNames, test } from '../../fixtures/demoqa-books.fixture';
import {
  ACCOUNT_TAG,
  BOOKS,
  DESKTOP_VIEWPORT,
  fakeUserName,
  MESSAGES,
  wrongLoginValue
} from '../../test-data/demoqa-books.data';

const LOGIN_URL = /\/login$/;
const PROFILE_URL = /\/profile$/;

// K6: account values are typed through evaluate, whose arguments a trace would record. trace
// must be file level (it forces a new worker).
// Trade-off: failures in this file have no trace; screenshots, video and error context remain.
test.use({ trace: 'off' });

test.describe('Authentication and session', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  // Guest tests.

  test('[DQB-022] Guest on a book detail page cannot add it to a collection', async ({ bookDetailPage }) => {
    await bookDetailPage.open(BOOKS.gitPocketGuide.isbn);

    await expect(bookDetailPage.session.loginButton).toBeVisible();
    await expect(bookDetailPage.backButton).toBeVisible();
    await expect(bookDetailPage.addToCollectionButton).toHaveCount(0);
    await expect(bookDetailPage.session.userNameLabel).toHaveCount(0);
    await expect(bookDetailPage.session.userNameValue).toHaveCount(0);
  });

  test('[DQB-023] Guest opening the profile sees the signed-out message', async ({ profilePage, page }) => {
    const response = await profilePage.goto();

    expect(response.status()).toBe(200);
    expect(response.request().redirectedFrom(), 'no redirect before /profile').toBeNull();
    await expect(page).toHaveURL(PROFILE_URL);
    await expect(profilePage.signedOutMessage).toHaveText(MESSAGES.signedOut);
    await expect(profilePage.signedOutLink('login')).toHaveAttribute('href', '/login');
    await expect(profilePage.signedOutLink('register')).toHaveAttribute('href', '/register');
    await expect(profilePage.table.table).toHaveCount(0);
    await expect(profilePage.logoutButton).toHaveCount(0);
    await expect(profilePage.deleteAccountButton).toHaveCount(0);
    await expect(profilePage.deleteAllBooksButton).toHaveCount(0);
  });

  test('[DQB-027] Unknown user name is rejected', async ({ loginPage, page }) => {
    await loginPage.open();
    const outcome = await loginPage.signIn(fakeUserName(), wrongLoginValue());

    expect(outcome).toBe('rejected');
    await expect(page).toHaveURL(LOGIN_URL);
    // R-18 closed: the same text as a wrong password (no account enumeration), confirmed on all 3 browsers.
    await expect(loginPage.errorMessage).toHaveText(MESSAGES.loginInvalid);
  });

  test('[DQB-028] Login submitted with both fields empty', async ({ loginPage, page }) => {
    await loginPage.open();
    await loginPage.submitEmpty();

    await expect(loginPage.userNameInput).toHaveClass(/\bis-invalid\b/);
    await expect(loginPage.passwordInput).toHaveClass(/\bis-invalid\b/);
    expect(await loginPage.errorText(), 'no text in p#name').toBe('');
    await expect(page).toHaveURL(LOGIN_URL);
  });

  test('[DQB-029] Login submitted with only a user name', async ({ loginPage, apiLog, page }) => {
    await loginPage.open();
    await loginPage.submitWithUserNameOnly(fakeUserName());

    await expect(loginPage.passwordInput).toHaveClass(/\bis-invalid\b/);
    await expect(loginPage.userNameInput).not.toHaveClass(/\bis-invalid\b/);
    expect(apiLog.count('POST', '/Account/v1/Login'), 'no login request').toBe(0);
    await expect(page).toHaveURL(LOGIN_URL);
  });

  // Signed-in tests (cached session, K2).

  test(
    '[DQB-024] Signed-in user sees account controls on a book detail page',
    { tag: [ACCOUNT_TAG] },
    async ({ signedIn, bookDetailPage }) => {
      await bookDetailPage.open(BOOKS.gitPocketGuide.isbn);

      expect(
        await bookDetailPage.session.userNameMatches(signedIn.account.userName),
        "User Name shows the browser's account"
      ).toBe(true);
      await expect(bookDetailPage.session.logoutButton).toHaveText(MESSAGES.logoutList);
      await expect(bookDetailPage.backButton).toBeVisible();
      await expect(bookDetailPage.addToCollectionButton).toBeVisible();
      await expect(bookDetailPage.session.loginButton).toHaveCount(0);
    }
  );

  test('[DQB-030] Session survives a reload of the profile page', { tag: [ACCOUNT_TAG] }, async ({ signedIn, profilePage, page }) => {
    await profilePage.openSignedIn();
    await profilePage.reload();

    await expect(page).toHaveURL(PROFILE_URL);
    expect(await profilePage.userNameMatches(signedIn.account.userName), "User Name shows the browser's account").toBe(true);
    await expect(profilePage.logoutButton).toBeVisible();
    await expect(profilePage.logoutButton).toHaveText(MESSAGES.logoutProfile);
    await expect(profilePage.signedOutMessage).toHaveCount(0);
  });

  test('[DQB-031] Signed-in user sees their name on the book list', { tag: [ACCOUNT_TAG], annotation: { type: 'issue', description: 'DEF-010' } }, async ({ signedIn, booksPage }) => {
    await booksPage.open();

    expect(await booksPage.session.userNameMatches(signedIn.account.userName), "User Name shows the browser's account").toBe(true);
    await expect(booksPage.session.logoutButton).toBeVisible();
    // Fails while DEF-010 is open (/books says "Log out"); soft so the Login check still runs.
    await expect
      .soft(booksPage.session.logoutButton, 'DEF-010 (R-24): logout button on /books is labelled "Logout", as on /profile')
      .toHaveText(MESSAGES.logoutProfile);
    await expect(booksPage.session.loginButton).toHaveCount(0);
  });

  // Fresh-login tests (the real login form; never the cached cookies).

  test('[DQB-025] Registered user signs in with valid credentials', { tag: [ACCOUNT_TAG] }, async ({ account, freshLogin, page }) => {
    const profile = await freshLogin();

    await expect(page).toHaveURL(PROFILE_URL);
    expect(await profile.userNameMatches(account.userName), "User Name shows the browser's account").toBe(true);
    await expect(profile.logoutButton).toHaveText(MESSAGES.logoutProfile);
    await expect(profile.booksHeading).toBeVisible();
  });

  test('[DQB-032] Logout from the profile ends the session', { tag: [ACCOUNT_TAG] }, async ({ freshLogin, profilePage, page }) => {
    const profile = await freshLogin();
    await profile.logOut();

    await expect(page).toHaveURL(LOGIN_URL);
    await expect.poll(() => sessionCookieNames(page.context()), { message: 'session cookies removed' }).toEqual([]);
    await profilePage.goto();
    await expect(profilePage.signedOutMessage).toHaveText(MESSAGES.signedOut);
  });

  test('[DQB-033] Log out from the book list ends the session', { tag: [ACCOUNT_TAG] }, async ({ freshLogin, booksPage, profilePage, page }) => {
    await freshLogin();
    await booksPage.open();

    const landingUrl = await booksPage.session.logOut();
    recordObservation('R-28', `"Log out" on /books leads to ${new URL(landingUrl).pathname}`);

    await expect(page).toHaveURL(LOGIN_URL);
    await expect.poll(() => sessionCookieNames(page.context()), { message: 'token cookie removed' }).not.toContain('token');
    await profilePage.goto();
    await expect(profilePage.signedOutMessage).toHaveText(MESSAGES.signedOut);
  });

  // K4: the only test that sends a real user name with a wrong value. Last in the file, no retries.
  test.describe('Wrong password for the browser account', () => {
    test.describe.configure({ retries: 0 });

    test(
      '[DQB-026] Real user name with a wrong password is rejected',
      { tag: [ACCOUNT_TAG] },
      async ({ account, loginCircuitBreaker, wrongPasswordBudget, loginPage, page }) => {
        loginCircuitBreaker.ensureClosed();
        wrongPasswordBudget.consume();
        const wrongValue = wrongLoginValue();

        await loginPage.open();
        const outcome = await test.step(
          'Sign in with the account user name and a generated wrong value',
          async () => loginPage.signIn(account.userName, wrongValue),
          { box: true }
        );

        expect(outcome).toBe('rejected');
        await expect(loginPage.errorMessage).toHaveText(MESSAGES.loginInvalid);
        await expect(page).toHaveURL(LOGIN_URL);
        await expect(loginPage.passwordInput).toHaveValue(wrongValue);
        expect(await sessionCookieNames(page.context()), 'no session token').not.toContain('token');
      }
    );
  });
});
