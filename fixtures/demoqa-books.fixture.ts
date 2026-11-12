import { test as base } from '@playwright/test';
import { getAccount, type Account } from '../lib/credentials-store.cjs';
import { DemoQaBookStorePage } from '../pages/demoqa-books/book-store.page';
import { DemoQaLoginPage } from '../pages/demoqa-books/login.page';
import { DemoQaProfilePage } from '../pages/demoqa-books/profile.page';

// One saved account per browser, so the three browsers never share a collection.
const ROLE_BY_BROWSER: Record<string, string> = { chromium: 'existingUser', firefox: 'firefoxUser', webkit: 'webkitUser' };

type Fixtures = {
  account: Account;
  loginPage: DemoQaLoginPage;
  bookStorePage: DemoQaBookStorePage;
  profilePage: DemoQaProfilePage;
};

export const test = base.extend<Fixtures>({
  account: async ({ browserName }, use) => {
    await use(await getAccount('demoqa-books', ROLE_BY_BROWSER[browserName], { required: ['userName', 'password'] }));
  },
  loginPage: async ({ page }, use) => use(new DemoQaLoginPage(page)),
  bookStorePage: async ({ page }, use) => use(new DemoQaBookStorePage(page)),
  profilePage: async ({ page }, use) => use(new DemoQaProfilePage(page))
});

export { expect } from '@playwright/test';
