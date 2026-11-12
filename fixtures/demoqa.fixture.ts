import { test as base, expect } from '@playwright/test';
import { DemoqaBookDetailPage } from '../pages/demoqa/book-detail.page';
import { DemoqaBooksPage } from '../pages/demoqa/books.page';

// Guest only: no account fixtures, so getAccount is never called for this app.
type Fixtures = {
  booksPage: DemoqaBooksPage;
  bookDetailPage: DemoqaBookDetailPage;
};

export const test = base.extend<Fixtures>({
  booksPage: async ({ page }, use) => use(new DemoqaBooksPage(page)),
  bookDetailPage: async ({ page }, use) => use(new DemoqaBookDetailPage(page))
});

export { expect };
