import type { Locator } from '@playwright/test';

/**
 * Types an account value without putting it in a report step title (locator.fill would show it).
 * DemoQA is a React app, so the value is set through the native input setter, which React notices,
 * and an input event is fired. Specs that use this turn trace off, because a trace records arguments.
 */
export async function fillAccountValue(input: Locator, value: string): Promise<void> {
  await input.waitFor();
  await input.evaluate((element, text) => {
    const field = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    field.focus();
    setter?.call(field, text);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
