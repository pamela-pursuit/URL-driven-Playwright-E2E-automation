import { expect, test } from '../../fixtures/demoqa-books.fixture';

// Account values are typed without appearing in reports; a trace would record them, so it is off here.
test.use({ trace: 'off' });

const BOOK = 'Git Pocket Guide';

test('[TC-01] Log in, add a book to the collection, then log out', async ({ account, loginPage, bookStorePage, profilePage, page }) => {
  test.setTimeout(90_000); // public practice site; one test covers the whole journey

  await test.step('Log in with the saved test account', async () => {
    await loginPage.open();
    await loginPage.logIn(account.userName, account.password);
    await expect(page).toHaveURL(/\/profile$/);
    await expect(profilePage.userNameValue).toBeVisible();
  });

  await test.step('Start with the book not in the collection', async () => {
    await profilePage.removeBook(BOOK); // leftover from an earlier, interrupted run
    await expect(profilePage.bookLink(BOOK)).toHaveCount(0);
  });

  await test.step('Add the book to the collection', async () => {
    await bookStorePage.open();
    await bookStorePage.openBook(BOOK);
    expect(await bookStorePage.addOpenBookToCollection()).toBe('Book added to your collection.');
  });

  await test.step('The book is listed on the Profile page', async () => {
    await profilePage.open();
    await expect(profilePage.bookLink(BOOK)).toBeVisible();
  });

  await test.step('Remove the book again', async () => {
    expect(await profilePage.removeBook(BOOK)).toBe('Book deleted.');
    await expect(profilePage.bookLink(BOOK)).toHaveCount(0);
  });

  await test.step('Log out', async () => {
    await profilePage.logOut();
    await expect(page).toHaveURL(/\/login$/);
    await expect(loginPage.loginButton).toBeVisible();
  });
});
