import type { Locator } from '@playwright/test';

/**
 * Fills an input with an account value without putting the value in a report step title (K6).
 *
 * `locator.fill(value)` is reported as `Fill "<value>"`; `evaluate` is reported as "Evaluate"
 * without its argument. demo-web-shop's `fillAccountValue` sets `element.value` directly, which
 * React ignores (its value tracker sees no change), so this uses the native HTMLInputElement value
 * setter and dispatches bubbling input/change events. Probe P2a: React accepts it and the login
 * succeeds on Chromium, Firefox and WebKit. Specs that use this turn trace off (a trace records
 * evaluate arguments).
 */
export async function fillSecretValue(input: Locator, value: string): Promise<void> {
  await input.waitFor();
  await input.evaluate((element, text) => {
    const field = element as HTMLInputElement;
    field.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) {
      throw new Error('HTMLInputElement value setter is not available');
    }
    setter.call(field, text);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.blur();
  }, value);
}

/** Boolean comparison only; never returns or prints the value. */
export async function inputHasValue(input: Locator, value: string): Promise<boolean> {
  return input.evaluate((element, text) => (element as HTMLInputElement).value === text, value);
}
