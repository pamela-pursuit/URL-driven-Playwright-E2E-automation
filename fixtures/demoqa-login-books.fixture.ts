import { test as base } from '@playwright/test';
import { getAccount, type Account } from '../lib/credentials-store.cjs';
import { DemoqaLoginPage } from '../pages/demoqa-login-books/login.page';
import { DemoqaProfilePage } from '../pages/demoqa-login-books/profile.page';
import { DemoqaSignedInBooksPage } from '../pages/demoqa-login-books/signed-in-books.page';

// One saved account per browser, so parallel browsers never sign each other out.
const ROLE_BY_BROWSER: Record<string, string> = {
  chromium: 'existingUser',
  firefox: 'firefoxUser',
  webkit: 'webkitUser'
};

type Fixtures = {
  account: Account;
  loginPage: DemoqaLoginPage;
  profilePage: DemoqaProfilePage;
  signedInBooksPage: DemoqaSignedInBooksPage;
  signIn: () => Promise<DemoqaProfilePage>;
};

export const test = base.extend<Fixtures>({
  account: async ({ browserName }, use) => {
    const role = ROLE_BY_BROWSER[browserName];
    if (!role) throw new Error(`No saved account role is set up for browser "${browserName}"`);
    await use(await getAccount('demoqa-books', role, { required: ['userName', 'password'] }));
  },
  loginPage: async ({ page }, use) => use(new DemoqaLoginPage(page)),
  profilePage: async ({ page }, use) => use(new DemoqaProfilePage(page)),
  signedInBooksPage: async ({ page }, use) => use(new DemoqaSignedInBooksPage(page)),
  signIn: async ({ loginPage, account }, use) => {
    await use(async () => {
      await loginPage.open();
      return loginPage.logIn(account.userName, account.password);
    });
  }
});

export { expect } from '@playwright/test';
