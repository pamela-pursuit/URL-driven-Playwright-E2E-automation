import { expect, recordObservation, test } from '../../fixtures/demo-web-shop.fixture';
import { ACCOUNT_NAVIGATION, HEADINGS, MESSAGES } from '../../test-data/demo-web-shop.data';

// P9: account values must not reach report artifacts. Values are filled without step titles
// (fillAccountValue); a trace would still record evaluate arguments and signed-in DOM snapshots,
// so tracing is off for this file (trace is worker-scoped, so it cannot be set per describe).
test.use({ trace: 'off' });

// Read-only: no form on these pages is ever submitted (requirements section 6).
test.describe('My account', () => {
  test('[TC-63] Customer info and account navigation are shown read-only', async ({ signedIn, accountPage, existingUser, page }) => {
    await signedIn.header.openAccount();

    await expect(page).toHaveURL(/\/customer\/info$/);
    await expect(page).toHaveTitle('Demo Web Shop. Account');
    await expect(accountPage.heading).toHaveText(HEADINGS.customerInfo);
    await expect(accountPage.pageBody).toContainText('Your Personal Details');
    await expect(accountPage.firstName).toBeVisible();
    await expect(accountPage.lastName).toBeVisible();
    await expect(accountPage.email).toBeVisible();
    expect(await accountPage.emailFieldShows(existingUser.email), 'Email field shows the existingUser email').toBe(true);
    await expect(accountPage.saveButton).toBeVisible();
    for (const name of ACCOUNT_NAVIGATION) {
      await expect(accountPage.navLink(name)).toBeVisible();
    }

    await accountPage.openSection('Addresses');
    await expect(accountPage.heading).toHaveText(HEADINGS.addresses);
    await expect(accountPage.addNewAddressButton).toBeVisible();

    await accountPage.openSection('Orders');
    await expect(accountPage.heading).toHaveText(HEADINGS.orders);
  });

  test('[TC-64] Addresses, Orders and Reward points show empty states', async ({ signedIn, accountPage }) => {
    void signedIn;
    recordObservation('assumption', 'ASSUMPTION-01: existingUser has no addresses, no orders and 0 reward points (R-29)');

    await accountPage.open('addresses');
    await expect(accountPage.pageBody, 'ASSUMPTION-01 broken: the shared account now has addresses').toContainText(MESSAGES.noAddresses);

    await accountPage.open('orders');
    await expect(accountPage.pageBody, 'ASSUMPTION-01 broken: the shared account now has orders').toContainText(MESSAGES.noOrders);

    await accountPage.open('rewardpoints');
    await expect(accountPage.heading).toHaveText(HEADINGS.rewardPoints);
    await expect(accountPage.pageBody, 'ASSUMPTION-01 broken: the reward points balance changed').toContainText(MESSAGES.rewardPointsBalance);
    await expect(accountPage.pageBody).toContainText(MESSAGES.rewardPointsHistory);
    await expect(accountPage.pageBody, 'ASSUMPTION-01 broken: reward points history exists').toContainText(MESSAGES.rewardPointsNoHistory);
  });

  test('[TC-65] Change password form fields are present', async ({ signedIn, accountPage }) => {
    void signedIn;
    await accountPage.open('changepassword');

    await expect(accountPage.heading).toHaveText(HEADINGS.changePassword);
    await expect(accountPage.oldPassword).toBeVisible();
    await expect(accountPage.newPassword).toBeVisible();
    await expect(accountPage.confirmNewPassword).toBeVisible();
    await expect(accountPage.changePasswordButton).toBeVisible();
  });
});

test.describe('Downloadable products', () => {

  test('[TC-66] Downloadable products page loads', async ({ signedIn, accountPage }) => {
    void signedIn;
    test.setTimeout(90_000);
    await accountPage.goto('downloadableproducts');

    // Defect DEF-005: this check fails until the defect is fixed (the page returns 200 but never renders (R-05).).
    await expect(accountPage.heading, 'DEF-005: the Downloadable products page shows its heading').toBeVisible({ timeout: 30_000 });
  });
});
