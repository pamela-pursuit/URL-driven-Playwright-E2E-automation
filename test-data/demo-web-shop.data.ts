/**
 * Test data for the demo-web-shop suite (https://demowebshop.tricentis.com/).
 *
 * Every text below was observed in test-plans/demo-web-shop/discovery.md (section 4) or in
 * the implementation probes recorded in architecture.md ("Implementation probes").
 * There are no secrets in this file. Account values come only from the existingUser fixture.
 */

export const PRODUCTS = {
  computingAndInternet: { name: 'Computing and Internet', path: 'computing-and-internet', price: 10 },
  healthBook: { name: 'Health Book', path: 'health', price: 10 },
  buildYourOwnComputer: { name: 'Build your own computer', path: 'build-your-own-computer' },
  science: { name: 'Science' }
} as const;

/** D1 / R-16: the only products the suite may add to or remove from the shared account. */
export const RESERVED_TEST_PRODUCTS = [PRODUCTS.healthBook.name, PRODUCTS.computingAndInternet.name] as const;

/** D1: pre-existing account items that the suite must never touch. */
export const PROTECTED_ACCOUNT_ITEMS = ['14.1-inch Laptop'] as const;

export const MESSAGES = {
  loginFailed: 'Login was unsuccessful. Please correct the errors and try again.',
  credentialsIncorrect: 'The credentials provided are incorrect',
  noCustomerAccount: 'No customer account found',
  invalidEmailLogin: 'Please enter a valid email address.',
  loginHeading: 'Welcome, Please Sign In!',

  firstNameRequired: 'First name is required.',
  lastNameRequired: 'Last name is required.',
  emailRequired: 'Email is required.',
  passwordRequired: 'Password is required.',
  wrongEmail: 'Wrong email',
  passwordMinLength: 'The password should have at least 6 characters.',
  passwordMismatch: 'The password and confirmation password do not match.',
  emailExists: 'The specified email already exists',

  searchNoResults: 'No products were found that matched your criteria.',
  searchMinLength: 'Search term minimum length is 3 characters',
  searchAlert: 'Please enter some search keyword',

  addedToCart: 'The product has been added to your shopping cart',
  addedToWishlist: 'The product has been added to your wishlist',
  quantityPositive: 'Quantity should be positive',
  /** Implementation probe P1: native alert when the add-to-cart AJAX call fails (abort or 500). */
  addToCartFailedAlert: 'Failed to add the product to the cart. Please refresh the page and try one more time.',

  /** Generic error page of the shared demo server (first full run, DWS-050 teardown). */
  serverError: "We're sorry, an internal error occurred.",

  cartEmpty: 'Your Shopping Cart is empty!',
  wishlistEmpty: 'The wishlist is empty!',
  wishlistShare: 'Your wishlist URL for sharing:',
  termsRequired: 'Please accept the terms of service before the next step.',
  couponInvalid: "The coupon code you entered couldn't be applied to your order",

  billingErrors: [
    'First name is required.',
    'Last name is required.',
    'Email is required.',
    'Country is required.',
    'City is required',
    'Street address is required',
    'Zip / postal code is required',
    'Phone is required'
  ],

  payByCod: 'You will pay by COD',
  codMethodName: 'Cash On Delivery (COD)',
  orderThankYou: 'Thank you',
  orderSuccess: 'Your order has been successfully processed!',
  orderDetailsLink: 'Click here for order details.',
  orderInformation: 'Order information',
  orderStatusPending: 'Order Status: Pending',

  backInStockNone: 'You are not currently subscribed to any Back In Stock notification lists',
  noAddresses: 'No addresses',
  noOrders: 'No orders',
  rewardPointsBalance: 'Your current balance is 0 reward points (0.00).',
  rewardPointsHistory: 'History',
  rewardPointsNoHistory: 'There is no balance history yet'
} as const;

export const HEADINGS = {
  search: 'Search',
  cart: 'Shopping cart',
  wishlist: 'Wishlist',
  checkout: 'Checkout',
  customerInfo: 'My account - Customer info',
  addresses: 'My account - Addresses',
  orders: 'My account - Orders',
  rewardPoints: 'My account - Reward points',
  changePassword: 'My account - Change password',
  backInStock: 'My account - Back in stock subscriptions'
} as const;

export const SEARCH = {
  match: 'computer',
  matchExpected: ['Build your own computer', 'Simple Computer'],
  noMatch: 'zzqxnotfound',
  tooShortHeader: 'ab',
  tooShortUrl: 'a',
  autocompletePrefix: 'comp',
  autocompleteExpected: ['Build your own computer', 'Computing and Internet'],
  whitespace: '   '
} as const;

export const LISTING = {
  category: 'Books',
  slug: 'books',
  sortPriceLowHigh: 'Price: Low to High',
  sortNameZA: 'Name: Z to A',
  pageSize: '4',
  priceFilter: 'Under 25.00',
  priceFilterMax: 25
} as const;

export const INVALID = {
  loginEmail: 'abc',
  email: 'not-an-email',
  whitespaceEmail: '   ',
  qty: ['0', 'abc'],
  negativeQty: '-1',
  coupon: 'INVALIDCOUPON',
  giftCard: 'INVALIDGIFT',
  shortPasswords: ['abc', 'abcde'],
  minPassword: 'abcdef',
  mismatchConfirm: 'abcdeg'
} as const;

/** D5: fictional guest data. The email is replaced per test by uniqueGuestEmail(). */
export const GUEST_ADDRESS = {
  firstName: 'QA',
  lastName: 'Automation',
  country: 'United States',
  state: 'New York',
  city: 'Testville',
  address1: '1 Test Street',
  zip: '10001',
  phone: '5550100'
} as const;

export type GuestCustomer = typeof GUEST_ADDRESS & { email: string };

/** Confirm Order / order details summary for one Health Book with Ground and COD (discovery 4.12). */
export const HEALTH_BOOK_COD_ORDER = {
  summaryAddressLines: ['QA Automation', '1 Test Street', 'Testville , New York 10001', 'United States'],
  shippingMethod: 'Ground',
  row: { name: 'Health Book', price: '10.00', qty: '1', total: '10.00' },
  confirmTotals: {
    'Sub-Total:': '10.00',
    'Shipping:': '10.00',
    'Payment method additional fee:': '7.00',
    'Tax:': '0.00',
    'Total:': '27.00'
  },
  orderDetailsTexts: [
    'Order Status: Pending',
    'Cash On Delivery (COD)',
    'Ground',
    'Sub-Total: 10.00',
    'Shipping: 10.00',
    'Payment method additional fee: 7.00',
    'Tax: 0.00',
    'Order Total: 27.00'
  ]
} as const;

export const ESTIMATE_SHIPPING = {
  country: 'United States',
  zip: '10001',
  options: ['Ground (0.00)', 'Next Day Air (0.00)', '2nd Day Air (0.00)', 'In-Store Pickup (0.00)']
} as const;

export const ACCOUNT_SECTIONS_PROTECTED = [
  'info',
  'orders',
  'addresses',
  'changepassword',
  'downloadableproducts',
  'rewardpoints'
] as const;

export const ACCOUNT_NAVIGATION = [
  'Customer info',
  'Addresses',
  'Orders',
  'Downloadable products',
  'Back in stock subscriptions',
  'Reward points',
  'Change password'
] as const;

export const CHECKOUT_STEP_TITLES = [
  'Billing Address',
  'Shipping Address',
  'Shipping Method',
  'Payment Method',
  'Payment Information',
  'Confirm Order'
] as const;

export const TOP_MENU = ['Books', 'Computers', 'Electronics', 'Apparel & Shoes', 'Digital downloads', 'Jewelry', 'Gift Cards'] as const;

export const MOBILE_VIEWPORT = { width: 375, height: 812 } as const;

export const THIRD_PARTY_BLOCKLIST = ['**/s7.addthis.com/**'] as const;

/** Implementation probe P1 (observed): POST /addproducttocart/details/13/1, .../details/22/2, /addproducttocart/catalog/13/1/1. */
export const ADD_TO_CART_URL = {
  details: /\/addproducttocart\/details\/\d+\/1(?:[/?#]|$)/,
  wishlist: /\/addproducttocart\/details\/\d+\/2(?:[/?#]|$)/,
  catalog: /\/addproducttocart\/catalog\/\d+\/1\/\d+(?:[/?#]|$)/
} as const;

export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function uniqueGuestEmail(): string {
  return `qa.guest+${uniqueSuffix()}@example.test`;
}

export function unknownEmail(): string {
  return `qa.unknown+${uniqueSuffix()}@example.test`;
}

export function wrongLoginValue(): string {
  return `wrong-${uniqueSuffix()}`;
}

export function registerDummyPassword(): string {
  return `Qa-${uniqueSuffix()}`;
}

export function formatPrice(value: number): string {
  return value.toFixed(2);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
