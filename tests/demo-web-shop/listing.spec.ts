import { expect, test } from '../../fixtures/demo-web-shop.fixture';
import { LISTING, PRODUCTS } from '../../test-data/demo-web-shop.data';

// Shared catalogue (R-02): assert order, ranges and containment, never totals.
test.describe('Category listing', () => {
  test('[TC-27] Books from the top menu sorted by price low to high', async ({ homePage, header, categoryPage, page }) => {
    await homePage.open();
    await header.openCategory(LISTING.category);

    await expect(page).toHaveURL(new RegExp(`/${LISTING.slug}$`));
    await expect(page).toHaveTitle(`Demo Web Shop. ${LISTING.category}`);
    await expect(categoryPage.productItems.first()).toBeVisible();

    await categoryPage.sortBy(LISTING.sortPriceLowHigh);
    await expect(page).toHaveURL(/orderby=10/);
    const prices = await categoryPage.productPrices();
    expect(prices.length).toBeGreaterThan(0);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test('[TC-28] Books sorted by name Z to A', async ({ categoryPage, page }) => {
    await categoryPage.open(LISTING.slug);
    await categoryPage.sortBy(LISTING.sortNameZA);

    await expect(page).toHaveURL(/orderby=6/);
    const names = await categoryPage.productNames();
    expect(names.length).toBeGreaterThan(1);
    expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a, 'en', { sensitivity: 'base' })));
  });

  test('[TC-29] Page size 4 paginates to page 2', async ({ categoryPage, page }) => {
    await categoryPage.open(LISTING.slug);
    await categoryPage.setPageSize(LISTING.pageSize);

    await expect(categoryPage.productItems).toHaveCount(Number(LISTING.pageSize));
    await expect(categoryPage.pagerLink('2')).toBeVisible();
    await expect(categoryPage.pagerLink('Next')).toBeVisible();

    await categoryPage.goToPage('Next');
    await expect(page).toHaveURL(/pagenumber=2/);
    await expect(categoryPage.productItems.first()).toBeVisible();
    await expect(categoryPage.pagerLink('Previous')).toBeVisible();
  });

  test('[TC-30] List view replaces the grid', async ({ categoryPage, page }) => {
    await categoryPage.open(LISTING.slug);
    await categoryPage.viewAs('List');

    await expect(page).toHaveURL(/viewmode=list/);
    await expect(categoryPage.productList).toBeVisible();
    await expect(categoryPage.productGrid).toHaveCount(0);
  });

  test('[TC-31] Under 25.00 price filter applies and is removed', async ({ categoryPage, page }) => {
    await categoryPage.open(LISTING.slug);
    await categoryPage.filterByPrice(LISTING.priceFilter);

    await expect(page).toHaveURL(/price=-25/);
    await expect(categoryPage.removeFilterLink).toBeVisible();
    await expect(categoryPage.productItem(PRODUCTS.science.name)).toHaveCount(0);
    const prices = await categoryPage.productPrices();
    expect(prices.length).toBeGreaterThan(0);
    for (const price of prices) {
      expect(price).toBeLessThan(LISTING.priceFilterMax);
    }

    await categoryPage.removePriceFilter();
    await expect(page).not.toHaveURL(/price=/);
    await expect(categoryPage.productItem(PRODUCTS.science.name)).toBeVisible();
  });
});
