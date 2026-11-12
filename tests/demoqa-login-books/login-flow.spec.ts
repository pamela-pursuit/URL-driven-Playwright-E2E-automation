import { test, expect } from '../../fixtures/demoqa-login-books.fixture';
import { NOT_LOGGED_IN_NOTICE } from '../../pages/demoqa-login-books/profile.page';
import { BOOK, EXPECTED_BOOK_COUNT, SEARCH_MATCH } from '../../test-data/demoqa.data';

// A trace records action arguments, so it stays off to keep account values out of reports.
test.use({ trace: 'off' });

test.describe('Log in and log out (signed in)', () => {
  test('[TC-01] A user logs in with the saved test account and sees their Profile page', async ({
    loginPage,
    profilePage,
    account
  }) => {
    await test.step('Open the Login page', async () => {
      await loginPage.open();
      await expect(loginPage.loginButton).toBeVisible();
    });
    await test.step('Type the saved user name in the "UserName" box', async () => {
      await loginPage.typeUserName(account.userName);
    });
    await test.step('Type the saved password in the "Password" box', async () => {
      await loginPage.typePassword(account.password);
    });
    await test.step('Click "Login"', async () => {
      await loginPage.submit();
      await expect(profilePage.userNameValue).toBeVisible();
      // Compared as true/false so a failure never prints the account value.
      const shown = (await profilePage.userNameValue.textContent())?.trim();
      expect(shown === account.userName, 'shows the user name of the saved account').toBe(true);
      await expect(profilePage.logoutButton).toBeVisible();
    });
  });

  test('[TC-02] A signed-in user opens the Book Store, searches for a book and then clears the search', async ({
    signIn,
    signedInBooksPage,
    account
  }) => {
    await signIn();

    await test.step('Open the Book Store', async () => {
      await signedInBooksPage.open();
    });
    await test.step('Wait for the books to appear', async () => {
      await expect(signedInBooksPage.bookRows).toHaveCount(EXPECTED_BOOK_COUNT);
      await expect(signedInBooksPage.userNameValue).toBeVisible();
      const shown = (await signedInBooksPage.userNameValue.textContent())?.trim();
      expect(shown === account.userName, 'shows the user name of the saved account').toBe(true);
      await expect(signedInBooksPage.logOutButton).toBeVisible();
      await expect(signedInBooksPage.loginButton).toBeHidden();
    });
    await test.step(`Type "${SEARCH_MATCH}" in the "Type to search" box`, async () => {
      await signedInBooksPage.search(SEARCH_MATCH);
    });
    await test.step('Check the list', async () => {
      await expect(signedInBooksPage.bookRows).toHaveCount(1);
      await expect(signedInBooksPage.bookLink(BOOK.title)).toBeVisible();
    });
    await test.step('Clear the box', async () => {
      await signedInBooksPage.clearSearch();
      await expect(signedInBooksPage.bookRows).toHaveCount(EXPECTED_BOOK_COUNT);
    });
  });

  test('[TC-03] A signed-in user logs out from the Book Store', async ({ signIn, signedInBooksPage, loginPage }) => {
    await signIn();
    await signedInBooksPage.open();
    await expect(signedInBooksPage.logOutButton).toBeVisible();

    await test.step('Click "Log out" on the Book Store', async () => {
      await signedInBooksPage.logOut();
    });
    await test.step('Check the Login page', async () => {
      await expect(loginPage.loginButton).toBeVisible();
      await expect(loginPage.userNameInput).toBeVisible();
      // Compared as true/false so a failure can never print an account value.
      await expect
        .poll(async () => (await loginPage.userNameInput.inputValue()) === '', { message: 'the UserName box is empty' })
        .toBe(true);
    });
    await test.step('Open the Book Store again', async () => {
      await signedInBooksPage.open();
      await expect(signedInBooksPage.loginButton).toBeVisible();
      await expect(signedInBooksPage.logOutButton).toHaveCount(0);
      await expect(signedInBooksPage.userNameValue).toHaveCount(0);
    });
  });

  test('[TC-04] A signed-in user logs out from the Profile page', async ({ signIn, profilePage, loginPage }) => {
    await signIn();
    await expect(profilePage.logoutButton).toBeVisible();

    await test.step('Click "Logout" on the Profile page', async () => {
      await profilePage.logOut();
    });
    await test.step('Check the Login page', async () => {
      await expect(loginPage.loginButton).toBeVisible();
    });
    await test.step('Open the Profile page again', async () => {
      await profilePage.open();
      await expect(profilePage.notLoggedInNotice).toHaveText(NOT_LOGGED_IN_NOTICE);
      await expect(profilePage.userNameValue).toHaveCount(0);
    });
  });
});
