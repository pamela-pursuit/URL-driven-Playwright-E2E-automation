import { expect, recordObservation, test } from '../../fixtures/demoqa-books.fixture';
import { ACCOUNT_TAG, DESKTOP_VIEWPORT, MESSAGES, OWN_BOOKS } from '../../test-data/demoqa-books.data';

// K6: account values are typed through evaluate, whose arguments a trace would record. trace
// must be file level (it forces a new worker).
test.use({ trace: 'off' });

// K5: each test uses its own book, removes a leftover copy first and removes it again in teardown
// (ownedBooks). "Delete All Books" and "Delete Account" are never clicked.
test.describe('Profile collection', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test('[DQB-034] Signed-in user adds a book to their collection', { tag: [ACCOUNT_TAG] }, async ({ signedIn, ownedBooks, bookDetailPage, profilePage, page }) => {
    void signedIn;
    test.slow();
    const book = OWN_BOOKS.add;
    await test.step('Arrange: remove a leftover copy of the book', () => ownedBooks.claim(book));

    await bookDetailPage.open(book.isbn);
    const detailUrl = page.url();
    const result = await bookDetailPage.addToCollection();

    expect(result.message).toBe(MESSAGES.bookAdded);
    expect(result.status, 'POST /BookStore/v1/Books status').toBe(201);
    await expect(page).toHaveURL(detailUrl);

    await profilePage.openSignedIn();
    await expect(profilePage.table.row(book.title)).toBeVisible();
    await expect(profilePage.table.cell(book.title, 'Title')).toHaveText(book.title);
    await expect(profilePage.table.cell(book.title, 'Author')).toHaveText(book.author);
    await expect(profilePage.table.cell(book.title, 'Publisher')).toHaveText(book.publisher);
    await expect(profilePage.deleteIcon(book.isbn)).toBeVisible();
  });

  test('[DQB-035] Adding a book already in the collection is refused', { tag: [ACCOUNT_TAG], annotation: { type: 'issue', description: 'DEF-009' } }, async ({ signedIn, ownedBooks, bookDetailPage, profilePage }) => {
    void signedIn;
    test.slow();
    const book = OWN_BOOKS.duplicate;
    await test.step('Arrange: the book is in the collection once', async () => {
      await ownedBooks.claim(book);
      await ownedBooks.addViaUi(book);
    });

    await bookDetailPage.open(book.isbn);
    const result = await bookDetailPage.addToCollection();

    // The 400 console error is expected (R-14). The prefix check recognises the refusal even if the
    // wording changes; the soft check fails while DEF-009 is open so the duplicate-row check still runs.
    expect(result.message).toContain(MESSAGES.bookAlreadyPresentPrefix);
    expect
      .soft(result.message, 'DEF-009 (R-23): duplicate-add message reads "…your collection", not "the your collection"')
      .not.toContain('the your');
    expect(result.status, 'POST /BookStore/v1/Books status').toBe(400);

    await profilePage.openSignedIn();
    await expect(profilePage.table.row(book.title)).toHaveCount(1);
  });

  test('[DQB-036] Added book stays after reload and after signing in again', { tag: [ACCOUNT_TAG] }, async ({ freshLogin, ownedBooks, profilePage }) => {
    test.slow();
    const book = OWN_BOOKS.persist;
    await test.step('Arrange: fresh login and the book added once', async () => {
      await freshLogin();
      await ownedBooks.claim(book);
      await ownedBooks.addViaUi(book);
    });

    await profilePage.openSignedIn();
    await expect(profilePage.table.row(book.title)).toBeVisible();

    await profilePage.reload();
    await expect(profilePage.table.row(book.title)).toBeVisible();
    await expect(profilePage.table.cell(book.title, 'Author')).toHaveText(book.author);
    await expect(profilePage.table.cell(book.title, 'Publisher')).toHaveText(book.publisher);

    await profilePage.logOut();
    const profile = await freshLogin();
    await profile.openSignedIn();

    // R-31: server-side persistence across sessions.
    await expect(profile.table.row(book.title)).toBeVisible();
    await expect(profile.table.cell(book.title, 'Author')).toHaveText(book.author);
    await expect(profile.table.cell(book.title, 'Publisher')).toHaveText(book.publisher);
  });

  test('[DQB-037] Cancelling the delete confirmation keeps the book', { tag: [ACCOUNT_TAG] }, async ({ signedIn, ownedBooks, profilePage, apiLog, alerts }) => {
    void signedIn;
    test.slow();
    const book = OWN_BOOKS.cancel;
    await test.step('Arrange: the book is in the collection', async () => {
      await ownedBooks.claim(book);
      await ownedBooks.addViaUi(book);
    });

    await profilePage.openSignedIn();
    await expect(profilePage.table.row(book.title)).toBeVisible();
    await profilePage.openDeleteDialog(book.isbn);

    await expect(profilePage.deleteDialog).toBeVisible();
    await expect(profilePage.deleteDialogTitle).toBeVisible();
    await expect(profilePage.deleteDialogBody).toBeVisible();
    await expect(profilePage.dialogOk).toBeVisible();
    await expect(profilePage.dialogCancel).toBeVisible();

    await profilePage.cancelDelete();

    await expect(profilePage.deleteDialog).toBeHidden();
    // Section 10.2 note 3: "no native alert" is proven by its proxies at this point: no DELETE
    // request was sent and no dialog event arrived by the time the modal closed and the row is re-checked.
    expect(apiLog.count('DELETE', '/BookStore/v1/Book'), 'no delete request').toBe(0);
    await expect(profilePage.table.row(book.title)).toBeVisible();
    expect(alerts.unexpected(), 'no native alert').toEqual([]);
  });

  test('[DQB-038] Signed-in user deletes one book from the collection', { tag: [ACCOUNT_TAG] }, async ({ signedIn, ownedBooks, profilePage }) => {
    void signedIn;
    test.slow();
    const book = OWN_BOOKS.delete;
    await test.step('Arrange: the book is in the collection', async () => {
      await ownedBooks.claim(book);
      await ownedBooks.addViaUi(book);
    });

    await profilePage.openSignedIn();
    await expect(profilePage.table.row(book.title)).toBeVisible();
    await profilePage.openDeleteDialog(book.isbn);
    const result = await profilePage.confirmDelete(book.title);

    expect(result.message).toBe(MESSAGES.bookDeleted);
    expect(result.status, 'DELETE /BookStore/v1/Book status').toBe(204);
    await expect(profilePage.table.row(book.title)).toBeHidden();

    await profilePage.reload();
    await expect(profilePage.table.row(book.title)).toHaveCount(0);
  });

  test('[DQB-039] Profile with an empty collection', { tag: [ACCOUNT_TAG] }, async ({ signedIn, ownedBooks, profilePage }) => {
    test.slow();
    await test.step('Arrange: remove leftovers of the suite\'s own books only', async () => {
      for (const book of Object.values(OWN_BOOKS)) {
        await ownedBooks.claim(book);
      }
    });

    await profilePage.openSignedIn();

    expect(await profilePage.userNameMatches(signedIn.account.userName), "User Name shows the browser's account").toBe(true);
    for (const column of ['Image', 'Title', 'Author', 'Publisher', 'Action'] as const) {
      await expect(profilePage.table.columnHeader(column)).toBeVisible();
    }
    // Visibility only; never clicked.
    await expect(profilePage.logoutButton).toHaveText(MESSAGES.logoutProfile);
    await expect(profilePage.goToStoreButton).toBeVisible();
    await expect(profilePage.deleteAccountButton).toBeVisible();
    await expect(profilePage.deleteAllBooksButton).toBeVisible();

    // R-16: books this suite does not own are never removed; their presence skips the empty check
    // (Skipped, not Passed; section 10.2 note 2).
    const foreign = await profilePage.table.titles();
    if (foreign.length > 0) {
      recordObservation('R-16', `Collection holds books this suite does not own: ${foreign.join('; ')}`);
    }
    test.skip(foreign.length > 0, 'R-16: the collection holds books this suite does not own; empty check skipped');

    await expect(profilePage.table.bookRows).toHaveCount(0);
    await expect(profilePage.table.pageInfo).toHaveText(MESSAGES.pageOfZero);
    // DEF-007 (R-21): no empty-state message is shown; none is specified, so none is asserted.
  });
});
