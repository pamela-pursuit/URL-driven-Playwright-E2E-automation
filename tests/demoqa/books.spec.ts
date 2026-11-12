import { expect, test } from '../../fixtures/demoqa.fixture';
import {
  BOOK,
  COLUMNS,
  EXPECTED_BOOK_COUNT,
  KNOWN_TITLES,
  PAGER,
  SEARCH_MATCH,
  SEARCH_NO_MATCH
} from '../../test-data/demoqa.data';

test.describe('Book Store (guest)', () => {
  test('[TC-01] A guest opens the Book Store and sees the list of books', async ({ booksPage }) => {
    await test.step('Open the Book Store as a guest', async () => {
      await booksPage.open();
    });

    await test.step('Wait for the books to appear', async () => {
      await expect(booksPage.table).toBeVisible();
      for (const column of COLUMNS) {
        await expect(booksPage.columnHeader(column)).toBeVisible();
      }
      await expect(booksPage.bookRows).toHaveCount(EXPECTED_BOOK_COUNT);
      for (const title of KNOWN_TITLES) {
        await expect(booksPage.bookLink(title)).toBeVisible();
      }
      await expect(booksPage.pager).toHaveText(PAGER.full);
    });
  });

  test('[TC-02] A guest searches for a book and then clears the search', async ({ booksPage }) => {
    await booksPage.open();

    await test.step(`Type "${SEARCH_MATCH}" in the "Type to search" box`, async () => {
      await booksPage.search(SEARCH_MATCH);
    });

    await test.step('Check the list', async () => {
      await expect(booksPage.bookRows).toHaveCount(1);
      await expect(booksPage.bookLink(BOOK.title)).toBeVisible();
    });

    await test.step(`Clear the box and type "${SEARCH_NO_MATCH}"`, async () => {
      await booksPage.clearSearch();
      await booksPage.search(SEARCH_NO_MATCH);
    });

    await test.step('Check the list', async () => {
      await expect(booksPage.bookRows).toHaveCount(0);
      await expect(booksPage.pager).toHaveText(PAGER.empty);
    });

    await test.step('Clear the box', async () => {
      await booksPage.clearSearch();
      await expect(booksPage.bookRows).toHaveCount(EXPECTED_BOOK_COUNT);
    });
  });

  test('[TC-03] A guest opens a book to see its details and goes back to the list', async ({ booksPage }) => {
    await booksPage.open();

    const detail = await test.step(`Click the book "${BOOK.title}"`, async () => booksPage.openBook(BOOK.title));

    await test.step('Check the book details', async () => {
      await expect(detail.titleValue).toHaveText(BOOK.title);
      await expect(detail.authorValue).toHaveText(BOOK.author);
      await expect(detail.publisherValue).toHaveText(BOOK.publisher);
    });

    await test.step('Click "Back To Book Store"', async () => {
      await detail.backToBookStore();
      await expect(booksPage.bookRows).toHaveCount(EXPECTED_BOOK_COUNT);
    });
  });
});
