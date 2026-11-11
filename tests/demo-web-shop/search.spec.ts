import { expect, recordObservation, test } from '../../fixtures/demo-web-shop.fixture';
import { MESSAGES, SEARCH } from '../../test-data/demo-web-shop.data';

test.describe('Search', () => {
  test('[TC-21] Header search returns matching products', async ({ homePage, header, searchPage, page }) => {
    await homePage.open();
    await header.search(SEARCH.match);

    await expect(page).toHaveURL(new RegExp(`/search\\?q=${SEARCH.match}$`));
    await expect(searchPage.heading).toBeVisible();
    // Shared catalogue (R-02): named matches and a non-zero count, not an exact total.
    for (const name of SEARCH.matchExpected) {
      await expect(searchPage.productItem(name)).toBeVisible();
    }
    expect(await searchPage.productItems.count()).toBeGreaterThan(0);
  });

  test('[TC-22] Search with no matches shows the empty message', async ({ homePage, header, searchPage, page }) => {
    await homePage.open();
    await header.search(SEARCH.noMatch);

    await expect(page).toHaveURL(new RegExp(`/search\\?q=${SEARCH.noMatch}$`));
    await expect(searchPage.productItems).toHaveCount(0);
    await expect(searchPage.results).toHaveText(MESSAGES.searchNoResults);
  });

  test('[TC-23] Search term below the minimum length is rejected', async ({ homePage, header, searchPage }) => {
    await test.step('Header search', async () => {
      await homePage.open();
      await header.search(SEARCH.tooShortHeader);
      await expect(searchPage.results).toHaveText(MESSAGES.searchMinLength);
      await expect(searchPage.productItems).toHaveCount(0);
    });
    await test.step('Direct URL', async () => {
      await searchPage.open(SEARCH.tooShortUrl);
      await expect(searchPage.results).toHaveText(MESSAGES.searchMinLength);
      await expect(searchPage.productItems).toHaveCount(0);
    });
  });

  test('[TC-24] Empty or default search term triggers an alert', async ({ homePage, header, page }) => {
    await homePage.open();
    await test.step('Cleared term', async () => {
      const message = await header.searchExpectingAlert('');
      expect(message).toBe(MESSAGES.searchAlert);
      await expect(page).toHaveURL(/\/$/);
    });
    await test.step('Default "Search store" value', async () => {
      await header.reload();
      const message = await header.searchExpectingAlert();
      expect(message).toBe(MESSAGES.searchAlert);
      await expect(page).toHaveURL(/\/$/);
    });
  });

  test('[TC-25] Header search autocomplete suggests products', async ({ homePage, header }) => {
    await homePage.open();
    await header.typeSearchPrefix(SEARCH.autocompletePrefix);

    for (const name of SEARCH.autocompleteExpected) {
      await expect(header.autocompleteItem(name)).toBeVisible();
    }
  });

  test('[TC-26] Whitespace-only search lists no products', async ({ homePage, header, searchPage }) => {
    await homePage.open();
    const observed = await header.searchAndObserve(SEARCH.whitespace);

    // R-22: record whether an alert or a results page appeared; assert only that nothing is listed.
    if (observed.kind === 'alert') {
      recordObservation('R-22', `alert: "${observed.message}"`);
    } else {
      recordObservation('R-22', `navigated to ${new URL(observed.url).pathname}${new URL(observed.url).search}; message: "${(await searchPage.results.innerText()).trim()}"`);
    }
    await expect(searchPage.productItems).toHaveCount(0);
  });
});
