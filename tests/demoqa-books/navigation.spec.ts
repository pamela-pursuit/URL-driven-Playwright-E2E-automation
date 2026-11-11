import { expect, recordObservation, test } from '../../fixtures/demoqa-books.fixture';
import { ACCOUNT_TAG, CATALOGUE_TITLES, DESKTOP_VIEWPORT } from '../../test-data/demoqa-books.data';

// K6: account values are typed through evaluate, whose arguments a trace would record. trace
// must be file level (it forces a new worker).
test.use({ trace: 'off' });

test.describe('Book Store navigation', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test('[TC-42] New User opens the register page', async ({ loginPage, page }) => {
    await loginPage.open();
    const register = await loginPage.openRegister();

    await expect(page).toHaveURL(/\/register$/);
    await expect(register.heading).toBeVisible();
  });

  test('[TC-43] Back to Login returns from the register page', async ({ registerPage, page }) => {
    await registerPage.open();
    const login = await registerPage.backToLogin();

    await expect(page).toHaveURL(/\/login$/);
    await expect(login.heading).toBeVisible();
  });

  test('[TC-44] Signed-out profile links lead to login and register', async ({ profilePage, page }) => {
    await profilePage.goto();
    const login = await profilePage.openSignedOutLink('login');
    await expect(page).toHaveURL(/\/login$/);
    await expect(login.heading).toBeVisible();

    await profilePage.goto();
    const register = await profilePage.openSignedOutLink('register');
    await expect(page).toHaveURL(/\/register$/);
    await expect(register.heading).toBeVisible();
  });

  test('[TC-45] Book Store Application menu links open their pages', async ({ booksPage, page }) => {
    await booksPage.open();
    const menu = booksPage.menu;

    await menu.open('Login');
    await expect(page).toHaveURL(/\/login$/);
    await expect(menu.item('Login')).toHaveClass(/\bactive\b/);

    await menu.open('Book Store');
    await expect(page).toHaveURL(/\/books$/);
    await expect(menu.item('Book Store')).toHaveClass(/\bactive\b/);

    await menu.open('Profile');
    await expect(page).toHaveURL(/\/profile$/);
    await expect(menu.item('Profile')).toHaveClass(/\bactive\b/);
  });

  test('[TC-46] Go To Book Store leads from the profile to the book list', { tag: [ACCOUNT_TAG] }, async ({ signedIn, profilePage, page }) => {
    void signedIn;
    await profilePage.openSignedIn();

    const landingUrl = await profilePage.goToBookStore();
    recordObservation('R-29', `"Go To Book Store" leads to ${new URL(landingUrl).pathname}`);

    await expect(page).toHaveURL(/\/books$/);
    await expect(profilePage.table.titleLinks).toHaveText(CATALOGUE_TITLES);
  });
});
