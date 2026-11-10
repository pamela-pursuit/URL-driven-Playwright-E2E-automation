import { expect, type Locator, type Page } from '@playwright/test';

/** First data on a page (rows visible after about 2.3 s, discovery F1). */
export const READY_MS = 15_000;
/** Login redirect took 3.9 to 5.1 s (R-12). */
export const LOGIN_REDIRECT_MS = 15_000;
export const ALERT_MS = 15_000;

/**
 * K7 / R-01: waits until React has attached its props to the anchor control. Probe P1 found
 * `__reactProps$<id>` on the search box, login button, register button and detail back button.
 */
export async function waitForHydration(anchor: Locator): Promise<void> {
  await anchor.waitFor({ timeout: READY_MS });
  await expect
    .poll(
      () =>
        anchor.evaluate((element) =>
          Object.keys(element).some((key) => key.startsWith('__reactProps$') || key.startsWith('__reactEventHandlers$'))
        ),
      { message: 'React props are attached to the ready control (R-01)', timeout: READY_MS }
    )
    .toBe(true);
}

/**
 * Fills a non-secret value and confirms the input kept it; refills if a re-render dropped it
 * (discovery 8: typed input was lost right after load in 2 runs). Never use for account values.
 */
export async function fillAndConfirm(input: Locator, value: string): Promise<void> {
  await expect(async () => {
    await input.fill(value);
    expect(await input.inputValue()).toBe(value);
  }).toPass({ timeout: 10_000 });
}

export async function documentScrollWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

/**
 * R-01: clicks a submit control until the client marks a field invalid. Safe to repeat only
 * because an empty or partial submit sends no request (probe P6: no request on /login or /register).
 */
export async function clickUntilInvalid(button: Locator, invalidInputs: Locator): Promise<void> {
  await expect(async () => {
    await button.click();
    await invalidInputs.first().waitFor({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}
