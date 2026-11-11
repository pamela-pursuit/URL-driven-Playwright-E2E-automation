import { expect, recordObservation, test } from '../../fixtures/demoqa-books.fixture';
import {
  AUTHORS_ASC,
  BOOKS,
  CATALOGUE_TITLES,
  DESKTOP_VIEWPORT,
  GIT_POCKET_GUIDE_DETAIL,
  MESSAGES,
  SEARCH,
  SEARCH_EXPECTED,
  TITLES_ASC,
  TITLES_DESC,
  UNKNOWN_ISBN
} from '../../test-data/demoqa-books.data';

const BOOKS_URL = /\/books$/;

test.describe('Book Store list, search, sort and detail', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test('[TC-01] Guest sees the 8-book catalogue on the Book Store', async ({ booksPage, page }) => {
    const response = await booksPage.open();

    expect(response.status()).toBe(200);
    expect(response.request().redirectedFrom(), 'no redirect before /books').toBeNull();
    await expect(page).toHaveURL(BOOKS_URL);
    for (const column of ['Image', 'Title', 'Author', 'Publisher'] as const) {
      await expect(booksPage.table.columnHeader(column)).toBeVisible();
    }
    await expect(booksPage.table.titleLinks).toHaveText(CATALOGUE_TITLES);
    await expect(booksPage.table.titleLink(BOOKS.gitPocketGuide.title)).toHaveAttribute(
      'href',
      `/books?search=${BOOKS.gitPocketGuide.isbn}`
    );
    await expect(booksPage.table.cell(BOOKS.gitPocketGuide.title, 'Author')).toHaveText(BOOKS.gitPocketGuide.author);
    await expect(booksPage.table.cell(BOOKS.gitPocketGuide.title, 'Publisher')).toHaveText(BOOKS.gitPocketGuide.publisher);
  });

  test('[TC-02] All 8 books fit on one page and the pager is disabled', async ({ booksPage }) => {
    await booksPage.open();

    await expect(booksPage.table.pageInfo).toHaveText(MESSAGES.pageOfOne);
    await expect(booksPage.table.previousButton).toBeDisabled();
    await expect(booksPage.table.nextButton).toBeDisabled();
    await expect(booksPage.table.titleLinks).toHaveCount(CATALOGUE_TITLES.length);
    for (const title of CATALOGUE_TITLES) {
      await expect(booksPage.table.titleLink(title)).toBeVisible();
    }
  });

  test('[TC-03] Search by part of a title', async ({ booksPage, page }) => {
    await booksPage.open();
    await booksPage.search(SEARCH.title);

    await expect(booksPage.table.titleLinks).toHaveText([BOOKS.gitPocketGuide.title]);
    await expect(page).toHaveURL(BOOKS_URL);
  });

  test('[TC-04] Search ignores letter case', async ({ booksPage }) => {
    await booksPage.open();
    await booksPage.search(SEARCH.titleUpper);

    await expect(booksPage.table.titleLinks).toHaveText([BOOKS.gitPocketGuide.title]);
  });

  test('[TC-05] Search by author name', async ({ booksPage }) => {
    await booksPage.open();
    await booksPage.search(SEARCH.author);

    await expect(booksPage.table.titleLinks).toHaveText([BOOKS.youDontKnowJs.title]);
    await expect(booksPage.table.bookRows).toHaveCount(1);
    await expect(booksPage.table.cell(BOOKS.youDontKnowJs.title, 'Author')).toHaveText(BOOKS.youDontKnowJs.author);
  });

  test('[TC-06] Search by publisher', async ({ booksPage }) => {
    await booksPage.open();
    await booksPage.search(SEARCH.publisher);

    await expect(booksPage.table.titleLinks).toHaveText(SEARCH_EXPECTED.publisher);
    await expect(booksPage.table.titleLinks).toHaveCount(6);
    for (const title of SEARCH_EXPECTED.noStarch) {
      await expect(booksPage.table.titleLink(title)).toHaveCount(0);
    }
  });

  test('[TC-07] Search matches a fragment inside a word', async ({ booksPage }) => {
    await booksPage.open();
    await booksPage.search(SEARCH.partial);

    await expect(booksPage.table.titleLinks).toHaveText(SEARCH_EXPECTED.partial);
  });

  test('[TC-08] Search term with an apostrophe', async ({ booksPage }) => {
    await booksPage.open();
    await booksPage.search(SEARCH.apostrophe);

    await expect(booksPage.table.titleLinks).toHaveText([BOOKS.youDontKnowJs.title]);
  });

  test('[TC-09] Search with no matching book shows an empty table', async ({ booksPage }) => {
    await booksPage.open();
    await booksPage.search(SEARCH.noMatch);

    await expect(booksPage.table.titleLinks).toHaveCount(0);
    for (const column of ['Image', 'Title', 'Author', 'Publisher'] as const) {
      await expect(booksPage.table.columnHeader(column)).toBeVisible();
    }
    await expect(booksPage.table.pageInfo).toHaveText(MESSAGES.pageOfZero);
    // DEF-007 (R-21): no empty-state message is shown; none is specified, so none is asserted.
  });

  test('[TC-10] Clearing the search restores the full list', async ({ booksPage }) => {
    await booksPage.open();
    await booksPage.search(SEARCH.title);
    await expect(booksPage.table.titleLinks).toHaveCount(1);

    await booksPage.clearSearch();

    await expect(booksPage.table.titleLinks).toHaveText(CATALOGUE_TITLES);
    await expect(booksPage.table.pageInfo).toHaveText(MESSAGES.pageOfOne);
  });

  test('[TC-11] Search text is not kept after a reload', async ({ booksPage, page }) => {
    await booksPage.open();
    await booksPage.search(SEARCH.title);
    await expect(booksPage.table.titleLinks).toHaveCount(1);
    await expect(page).toHaveURL(BOOKS_URL);

    await booksPage.reload();

    await expect(booksPage.searchBox).toHaveValue('');
    await expect(booksPage.table.titleLinks).toHaveText(CATALOGUE_TITLES);
  });

  test('[TC-12] Search term with leading and trailing spaces finds the same books', { annotation: { type: 'issue', description: 'DEF-005' } }, async ({ booksPage }) => {
    await booksPage.open();
    await booksPage.search(SEARCH.title);
    await expect(booksPage.table.titleLinks).toHaveText([BOOKS.gitPocketGuide.title]);
    const unpaddedTitles = await booksPage.table.titleLinks.allTextContents();

    await booksPage.search(SEARCH.padded);

    // Fails while DEF-005 is open ("  git  " finds no book).
    await expect(
      booksPage.table.titleLinks,
      'DEF-005 (R-19): search ignores leading and trailing spaces'
    ).toHaveText(unpaddedTitles);
  });

  test('[TC-13] Searching by ISBN finds the book', { annotation: { type: 'issue', description: 'DEF-006' } }, async ({ booksPage }) => {
    await booksPage.open();
    await booksPage.search(SEARCH.isbn);

    // Fails while DEF-006 is open (the ISBN finds no book).
    await expect(
      booksPage.table.titleLinks,
      'DEF-006 (R-20): searching the ISBN shows that book'
    ).toHaveText([BOOKS.gitPocketGuide.title]);
  });

  test('[TC-14] Search with regular-expression characters keeps the page usable', async ({ booksPage, pageErrors }) => {
    await booksPage.open();
    // Section 10.2 note 5: only errors raised between typing and clearing count (blocked ad code may
    // raise errors at load).
    pageErrors.mark();

    await booksPage.search(SEARCH.regex);
    await expect(booksPage.table.titleLinks).toHaveCount(0);
    await expect(booksPage.table.pageInfo).toHaveText(MESSAGES.pageOfZero);

    await booksPage.clearSearch();
    await expect(booksPage.table.titleLinks).toHaveText(CATALOGUE_TITLES);
    expect(pageErrors.sinceMark(), 'no uncaught page error while searching').toEqual([]);
  });

  test('[TC-15] Title sort cycles ascending, descending and original order', async ({ booksPage }) => {
    await booksPage.open();

    await test.step('Click 1: ascending', async () => {
      await booksPage.table.sortBy('Title');
      await expect(booksPage.table.titleLinks).toHaveText(TITLES_ASC);
      await expect(booksPage.table.sortIndicator('Title', 'asc')).toHaveText('↑');
    });
    await test.step('Click 2: descending', async () => {
      await booksPage.table.sortBy('Title');
      await expect(booksPage.table.titleLinks).toHaveText(TITLES_DESC);
      await expect(booksPage.table.sortIndicator('Title', 'desc')).toHaveText('↓');
    });
    await test.step('Click 3: original order', async () => {
      await booksPage.table.sortBy('Title');
      await expect(booksPage.table.titleLinks).toHaveText(CATALOGUE_TITLES);
      await expect(booksPage.table.anySortIndicator).toHaveCount(0);
    });
  });

  test('[TC-16] Author sort orders rows by author ascending', async ({ booksPage }) => {
    await booksPage.open();
    await booksPage.table.sortBy('Author');

    await expect(booksPage.table.columnCells('Author')).toHaveText(AUTHORS_ASC);
    await expect(booksPage.table.sortIndicator('Author', 'asc')).toBeVisible();
  });

  test('[TC-17] Image column is not sortable', async ({ booksPage }) => {
    await booksPage.open();
    await booksPage.table.sortBy('Image');

    // Sorting is synchronous client-side (discovery 3.1), so the state right after the click is final.
    await expect(booksPage.table.titleLinks).toHaveText(CATALOGUE_TITLES);
    await expect(booksPage.table.anySortIndicator).toHaveCount(0);
  });

  test('[TC-18] Guest opens a book and sees its details', { annotation: { type: 'issue', description: 'DEF-011' } }, async ({ booksPage, page }) => {
    await booksPage.open();
    const detail = await booksPage.openBook(GIT_POCKET_GUIDE_DETAIL.title);

    await expect(page).toHaveURL(new RegExp(`/books\\?search=${GIT_POCKET_GUIDE_DETAIL.isbn}$`));
    await expect(detail.fieldValue('isbn')).toHaveText(GIT_POCKET_GUIDE_DETAIL.isbn);
    await expect(detail.fieldValue('title')).toHaveText(GIT_POCKET_GUIDE_DETAIL.title);
    await expect(detail.fieldValue('subtitle')).toHaveText(GIT_POCKET_GUIDE_DETAIL.subTitle);
    await expect(detail.fieldValue('author')).toHaveText(GIT_POCKET_GUIDE_DETAIL.author);
    await expect(detail.fieldValue('publisher')).toHaveText(GIT_POCKET_GUIDE_DETAIL.publisher);
    await expect(detail.fieldValue('pages')).toHaveText(GIT_POCKET_GUIDE_DETAIL.totalPages);
    await expect(detail.fieldValue('description')).not.toBeEmpty();
    // Fails while DEF-011 is open: the API itself returns the description cut at 255 characters
    // mid-word, and the page shows it unchanged. Soft, so the Website check still runs.
    expect
      .soft(
        ((await detail.fieldValue('description').textContent()) ?? '').trim(),
        'DEF-011 (R-25): description is not cut off mid-word'
      )
      .toMatch(/[.!?…]["')\]]?$/);
    // Probe P4: the Website value is rendered as a label, not a link; presence is asserted.
    await expect(detail.fieldValue('website')).not.toBeEmpty();
  });

  // "Back To Book Store" is a history-back control, so the detail page is reached from the list.
  test('[TC-19] Back To Book Store returns to the list', async ({ booksPage, page }) => {
    await booksPage.open();
    const detail = await booksPage.openBook(GIT_POCKET_GUIDE_DETAIL.title);
    const list = await detail.backToBookStore();

    await expect(page).toHaveURL(BOOKS_URL);
    await expect(list.table.titleLinks).toHaveText(CATALOGUE_TITLES);
  });

  test('[TC-20] Detail URL with an unknown ISBN shows empty fields', async ({ bookDetailPage }) => {
    const status = await bookDetailPage.openUnknown(UNKNOWN_ISBN);

    expect(status, 'GET /BookStore/v1/Book?ISBN=0000000000 status').toBe(400);
    await expect(bookDetailPage.wrapper('title')).toBeVisible();
    await expect(bookDetailPage.fieldValue('title')).toHaveText('');
    await expect(bookDetailPage.backButton).toBeVisible();
    // DEF-008 (R-22): no not-found message is shown; its text is not specified, so none is asserted.
  });

  test('[TC-21] Book list when the books service fails', { annotation: { type: 'issue', description: 'DEF-001' } }, async ({ booksApi, booksPage, alerts, pageErrors }) => {
    const { fired } = await booksApi.failListWith(500);
    pageErrors.mark();

    await booksPage.openExpectingNoRows();
    await fired;

    // Fails while DEF-001 is open (the app renders a blank page); the pageErrors fixture then
    // annotates the uncaught errors seen since the mark.
    await expect(
      booksPage.searchBox,
      'DEF-001 (R-30): list page stays usable when GET /BookStore/v1/Books returns 500'
    ).toBeVisible({ timeout: 10_000 });
    await expect(booksPage.table.titleLinks).toHaveCount(0);

    const pagerText = await booksPage.table.pageInfo.allInnerTexts();
    const errors = pageErrors.sinceMark();
    recordObservation(
      'R-30',
      `Pager text: ${pagerText.join(' | ') || '(none)'}; native alerts: ${alerts.unexpected().join(' | ') || '(none)'}; page errors: ${errors.join(' | ') || '(none)'}`
    );
  });
});
