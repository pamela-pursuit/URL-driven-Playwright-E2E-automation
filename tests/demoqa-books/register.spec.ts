import { expect, recordObservation, test } from '../../fixtures/demoqa-books.fixture';
import { DESKTOP_VIEWPORT, fakeUserName, MESSAGES, REGISTER } from '../../test-data/demoqa-books.data';

const REGISTER_URL = /\/register$/;

// R-07: no account is ever created. Only the weak value "abc" is submitted, guarded in the page object.
test.describe('Register form validation', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test('[DQB-040] Register form submitted with all fields empty', async ({ registerPage, apiLog, page }) => {
    await registerPage.open();
    await registerPage.submitEmpty();

    for (const input of registerPage.inputs) {
      await expect(input).toHaveClass(/\bis-invalid\b/);
    }
    expect(await registerPage.errorText(), 'no text in p#name').toBe('');
    await expect(page).toHaveURL(REGISTER_URL);
    expect(apiLog.count('POST', '/Account/v1/User'), 'no register request').toBe(0);
  });

  test('[DQB-041] Register with a weak password shows the server rule message', async ({ registerPage, page }) => {
    const form = {
      firstName: REGISTER.firstName,
      lastName: REGISTER.lastName,
      userName: fakeUserName(),
      password: REGISTER.weakPassword
    };
    await registerPage.open();
    await registerPage.fillForm(form);

    const { status, bodyKeys } = await registerPage.submitExpectingRejection();

    expect(status, 'POST /Account/v1/User status').toBe(400);
    await expect(registerPage.errorMessage).toHaveText(MESSAGES.weakPassword);
    await expect(registerPage.firstName).toHaveValue(form.firstName);
    await expect(registerPage.lastName).toHaveValue(form.lastName);
    await expect(registerPage.userName).toHaveValue(form.userName);
    await expect(registerPage.password).toHaveValue(form.password);
    await expect(page).toHaveURL(REGISTER_URL);
    const captchaKeys = bodyKeys.filter((key) => /captcha/i.test(key));
    const captchaNote = captchaKeys.length > 0
      ? `captcha field sent to the server: ${captchaKeys.join(', ')}`
      : 'no captcha token sent to the server';
    recordObservation(
      'R-26',
      `Register request sent after the automatic reCAPTCHA v3 token; body keys: ${bodyKeys.join(', ')} (${captchaNote})`
    );
  });
});
