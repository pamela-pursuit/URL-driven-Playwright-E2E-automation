import { test, type Dialog, type Page } from '@playwright/test';
import { ALERT_MS } from './app-ready';

/**
 * K9 / R-02: one `dialog` listener per page. demoqa reports add, duplicate add and delete results
 * through native `alert()`. Page objects arm an expectation before the click; any dialog that
 * arrives without one is accepted and recorded as unexpected (never silently auto-dismissed).
 */
export class DemoqaAlerts {
  private static readonly instances = new WeakMap<Page, DemoqaAlerts>();

  private armed = 0;
  private readonly unexpectedMessages: string[] = [];

  private constructor(private readonly page: Page) {
    page.on('dialog', (dialog) => this.handle(dialog));
  }

  static for(page: Page): DemoqaAlerts {
    let alerts = DemoqaAlerts.instances.get(page);
    if (!alerts) {
      alerts = new DemoqaAlerts(page);
      DemoqaAlerts.instances.set(page, alerts);
    }
    return alerts;
  }

  /**
   * Runs the action and waits for the native alert it raises, in parallel (a click resolves only
   * after the dialog is handled). The listener accepts the dialog; this returns its message.
   */
  async acceptNext(actionName: string, action: () => Promise<unknown>, timeout = ALERT_MS): Promise<string> {
    return test.step(
      `Accept the native alert after ${actionName}`,
      async () => {
        this.armed += 1;
        try {
          const [, dialog] = await Promise.all([action(), this.page.waitForEvent('dialog', { timeout })]);
          return dialog.message();
        } finally {
          // A missed alert must not turn a later, unrelated dialog into an "expected" one.
          this.armed = 0;
        }
      },
      { box: true }
    );
  }

  unexpected(): string[] {
    return [...this.unexpectedMessages];
  }

  private async handle(dialog: Dialog): Promise<void> {
    if (this.armed > 0) {
      this.armed -= 1;
    } else {
      this.unexpectedMessages.push(`${dialog.type()}: ${dialog.message()}`);
    }
    await dialog.accept();
  }
}
