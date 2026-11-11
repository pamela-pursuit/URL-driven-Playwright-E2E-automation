import { expect, test } from '../../fixtures/demo-web-shop.fixture';
import { GUEST_ADDRESS, INVALID, MESSAGES, registerDummyPassword } from '../../test-data/demo-web-shop.data';

// P9: account values must not reach report artifacts. Values are filled without step titles
// (fillAccountValue); a trace would still record evaluate arguments and signed-in DOM snapshots,
// so tracing is off for this file (trace is worker-scoped, so it cannot be set per describe).
test.use({ trace: 'off' });

// No test may create an account (intake decision): only invalid or duplicate data is submitted.
test.describe('Registration validation', () => {
  test('[TC-16] Empty registration form shows required messages', async ({ registerPage, page }) => {
    await registerPage.open();
    await registerPage.submitEmpty();

    await expect(page).toHaveURL(/\/register$/);
    await expect(registerPage.errorSummary).toHaveCount(0);
    await expect(registerPage.fieldError('FirstName')).toHaveText(MESSAGES.firstNameRequired);
    await expect(registerPage.fieldError('LastName')).toHaveText(MESSAGES.lastNameRequired);
    await expect(registerPage.fieldError('Email')).toHaveText(MESSAGES.emailRequired);
    await expect(registerPage.fieldError('Password')).toHaveText(MESSAGES.passwordRequired);
    await expect(registerPage.fieldError('ConfirmPassword')).toHaveText(MESSAGES.passwordRequired);
  });

  test('[TC-17] Invalid email format is rejected', async ({ registerPage, header, page }) => {
    await registerPage.open();
    await registerPage.enterEmailAndBlur(INVALID.email);

    await expect(registerPage.fieldError('Email')).toHaveText(MESSAGES.wrongEmail);
    await expect(page).toHaveURL(/\/register$/);
    await expect(header.loginLink).toBeVisible();
    await expect(header.registerLink).toBeVisible();
  });

  test('[TC-18] Password length boundary 5 vs 6 characters', async ({ registerPage }) => {
    await registerPage.open();
    for (const value of INVALID.shortPasswords) {
      await test.step(`${value.length} characters`, async () => {
        await registerPage.enterPasswordAndBlur(value);
        await expect(registerPage.fieldError('Password')).toHaveText(MESSAGES.passwordMinLength);
      });
    }
    await test.step(`${INVALID.minPassword.length} characters`, async () => {
      await registerPage.enterPasswordAndBlur(INVALID.minPassword);
      await expect(registerPage.fieldError('Password')).toBeHidden();
    });
  });

  test('[TC-19] Confirm password mismatch is rejected', async ({ registerPage }) => {
    await registerPage.open();
    await registerPage.enterPasswordAndBlur(INVALID.minPassword);
    await registerPage.enterConfirmPasswordAndBlur(INVALID.mismatchConfirm);

    await expect(registerPage.fieldError('ConfirmPassword')).toHaveText(MESSAGES.passwordMismatch);
    await expect(registerPage.fieldError('Password')).toBeHidden();
  });

  test.describe('Existing account email', () => {
    test('[TC-20] Duplicate email registration is rejected without creating an account', async ({ registerPage, header, existingUser, page }) => {
      await registerPage.open();
      await registerPage.attemptDuplicateRegistration({
        firstName: GUEST_ADDRESS.firstName,
        lastName: GUEST_ADDRESS.lastName,
        email: existingUser.email,
        password: registerDummyPassword()
      });

      await expect(registerPage.errorSummary).toHaveText(MESSAGES.emailExists);
      await expect(page).toHaveURL(/\/register$/);
      await expect(header.loginLink).toBeVisible();
      await expect(header.registerLink).toBeVisible();
    });
  });
});
