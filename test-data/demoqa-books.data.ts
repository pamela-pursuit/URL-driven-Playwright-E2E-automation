/**
 * Test data for the demoqa-books suite (https://demoqa.com/ Book Store Application).
 *
 * Every text below was observed in test-plans/demoqa-books/discovery.md (sections 3 and 4) or in
 * the implementation probes (architecture.md section 9). Values marked "Derived" are computed from
 * verified data. There are no secrets in this file. Account values come only from the fixture.
 */
import type { Response } from '@playwright/test';

export interface Book {
  title: string;
  author: string;
  publisher: string;
  isbn: string;
}

export const BOOKS = {
  gitPocketGuide: { title: 'Git Pocket Guide', author: 'Richard E. Silverman', publisher: "O'Reilly Media", isbn: '9781449325862' },
  learningJsPatterns: { title: 'Learning JavaScript Design Patterns', author: 'Addy Osmani', publisher: "O'Reilly Media", isbn: '9781449331818' },
  designingApis: { title: 'Designing Evolvable Web APIs with ASP.NET', author: 'Glenn Block et al.', publisher: "O'Reilly Media", isbn: '9781449337711' },
  speakingJs: { title: 'Speaking JavaScript', author: 'Axel Rauschmayer', publisher: "O'Reilly Media", isbn: '9781449365035' },
  youDontKnowJs: { title: "You Don't Know JS", author: 'Kyle Simpson', publisher: "O'Reilly Media", isbn: '9781491904244' },
  programmingJsApps: { title: 'Programming JavaScript Applications', author: 'Eric Elliott', publisher: "O'Reilly Media", isbn: '9781491950296' },
  eloquentJs: { title: 'Eloquent JavaScript, Second Edition', author: 'Marijn Haverbeke', publisher: 'No Starch Press', isbn: '9781593275846' },
  understandingEs6: { title: 'Understanding ECMAScript 6', author: 'Nicholas C. Zakas', publisher: 'No Starch Press', isbn: '9781593277574' }
} as const satisfies Record<string, Book>;

/** The 8 titles in the verified original (unsorted) order. */
export const CATALOGUE_TITLES = Object.values(BOOKS).map((book) => book.title);

/** Derived: all first letters differ, so a plain A-Z order is unambiguous. */
export const TITLES_ASC = [
  'Designing Evolvable Web APIs with ASP.NET',
  'Eloquent JavaScript, Second Edition',
  'Git Pocket Guide',
  'Learning JavaScript Design Patterns',
  'Programming JavaScript Applications',
  'Speaking JavaScript',
  'Understanding ECMAScript 6',
  "You Don't Know JS"
];
export const TITLES_DESC = [...TITLES_ASC].reverse();

/** Derived (first and last verified in discovery 3.1). */
export const AUTHORS_ASC = [
  'Addy Osmani',
  'Axel Rauschmayer',
  'Eric Elliott',
  'Glenn Block et al.',
  'Kyle Simpson',
  'Marijn Haverbeke',
  'Nicholas C. Zakas',
  'Richard E. Silverman'
];

export const GIT_POCKET_GUIDE_DETAIL = {
  isbn: '9781449325862',
  title: 'Git Pocket Guide',
  subTitle: 'A Working Introduction',
  author: 'Richard E. Silverman',
  publisher: "O'Reilly Media",
  totalPages: '234',
  website: 'http://chimera.labs.oreilly.com/books/1230000000561/index.html'
} as const;

export type OwnBook = Book;

/** K5: one book per collection test. The only books the suite may add to or remove from an account. */
export const OWN_BOOKS = {
  add: BOOKS.gitPocketGuide,
  duplicate: BOOKS.learningJsPatterns,
  persist: BOOKS.speakingJs,
  cancel: BOOKS.designingApis,
  delete: BOOKS.youDontKnowJs
} as const satisfies Record<string, OwnBook>;

export const OWN_BOOK_ISBNS: readonly string[] = Object.values(OWN_BOOKS).map((book) => book.isbn);

export const SEARCH = {
  title: 'git',
  titleUpper: 'GIT',
  author: 'Kyle',
  publisher: "O'Reilly Media",
  partial: 'script',
  apostrophe: "Don't",
  noMatch: 'zzzznotabook',
  padded: '  git  ',
  isbn: '9781449325862',
  regex: '(.*'
} as const;

export const SEARCH_EXPECTED = {
  publisher: CATALOGUE_TITLES.filter((_, index) => Object.values(BOOKS)[index].publisher === "O'Reilly Media"),
  partial: [
    'Learning JavaScript Design Patterns',
    'Speaking JavaScript',
    'Programming JavaScript Applications',
    'Eloquent JavaScript, Second Edition',
    'Understanding ECMAScript 6'
  ],
  noStarch: ['Eloquent JavaScript, Second Edition', 'Understanding ECMAScript 6']
};

export const UNKNOWN_ISBN = '0000000000';

export const MESSAGES = {
  loginInvalid: 'Invalid username or password!',
  bookAdded: 'Book added to your collection.',
  /** Exact observed wording, including "the your" (R-23). */
  bookAlreadyPresent: 'Book already present in the your collection!',
  bookDeleted: 'Book deleted.',
  deleteDialogTitle: 'Delete Book',
  deleteDialogBody: 'Do you want to delete this book?',
  signedOut:
    'Currently you are not logged into the Book Store application, please visit the login page to enter or register page to register yourself.',
  weakPassword:
    "Passwords must have at least one non alphanumeric character, one digit ('0'-'9'), one uppercase ('A'-'Z'), one lowercase ('a'-'z'), one special character and Password must be eight characters or longer.",
  /** API response body only; used for an absence check (DQB-020). */
  isbnNotAvailable: 'ISBN supplied is not available in Books Collection!',
  pageOfOne: 'Page 1 of 1',
  pageOfZero: 'Page 1 of 0',
  logoutList: 'Log out',
  logoutProfile: 'Logout'
} as const;

export const REGISTER = {
  firstName: 'QA',
  lastName: 'Automation',
  weakPassword: 'abc'
} as const;

/** Verified `pattern` of the register Password input (discovery 3.4). Used only by the R-07 guard. */
export const STRONG_PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})/;

export type Role = 'existingUser' | 'firefoxUser' | 'webkitUser';

/** I2 / K1: one account per browser project. */
export const ROLE_BY_PROJECT: Record<string, Role> = {
  chromium: 'existingUser',
  firefox: 'firefoxUser',
  webkit: 'webkitUser'
};

/** The four demoqa.com session cookies (discovery 3.3). Names only; values are never read by specs. */
export const SESSION_COOKIES = ['token', 'expires', 'userID', 'userName'] as const;

const DEMOQA_HOST = /(^|\.)demoqa\.com$/;

function apiPath(response: Response, method: string, path: string): URL | null {
  const url = new URL(response.url());
  if (!DEMOQA_HOST.test(url.hostname) || response.request().method() !== method || url.pathname !== path) {
    return null;
  }
  return url;
}

/** Response predicates for page.waitForResponse (discovery 6). */
export const API = {
  booksList: (response: Response) => apiPath(response, 'GET', '/BookStore/v1/Books') !== null,
  bookByIsbn: (isbn: string) => (response: Response) =>
    apiPath(response, 'GET', '/BookStore/v1/Book')?.searchParams.get('ISBN') === isbn,
  addBooks: (response: Response) => apiPath(response, 'POST', '/BookStore/v1/Books') !== null,
  deleteBook: (response: Response) => apiPath(response, 'DELETE', '/BookStore/v1/Book') !== null,
  generateToken: (response: Response) => apiPath(response, 'POST', '/Account/v1/GenerateToken') !== null,
  login: (response: Response) => apiPath(response, 'POST', '/Account/v1/Login') !== null,
  accountUser: (response: Response) => {
    const url = new URL(response.url());
    return (
      DEMOQA_HOST.test(url.hostname) &&
      response.request().method() === 'GET' &&
      /^\/Account\/v1\/User\/[^/]+$/.test(url.pathname)
    );
  },
  createUser: (response: Response) => apiPath(response, 'POST', '/Account/v1/User') !== null
};

export const API_GLOB = {
  booksList: '**/BookStore/v1/Books'
} as const;

/**
 * Host suffixes blocked in every test (discovery 8, R-03). reCAPTCHA (www.google.com,
 * www.gstatic.com) is deliberately allowed (K8). `googletagservices.com` added from implementation
 * probe P9 (still requested with the original list active).
 */
export const THIRD_PARTY_BLOCKLIST = [
  'googlesyndication.com',
  'doubleclick.net',
  'criteo.com',
  'criteo.net',
  'openx.net',
  'openxcdn.net',
  'id5-sync.com',
  'crwdcntrl.net',
  'adsrvr.org',
  'creativecdn.com',
  'ladsp.com',
  'adx.opera.com',
  'temu.com',
  'adtrafficquality.google',
  'google-analytics.com',
  'googletagmanager.com',
  'googletagservices.com'
] as const;

/** Never blocked, whatever the list says. */
export const NEVER_BLOCKED_HOSTS = ['demoqa.com', 'www.google.com', 'www.gstatic.com'] as const;

export const DESKTOP_VIEWPORT = { width: 1280, height: 900 } as const;
export const MOBILE_VIEWPORT = { width: 375, height: 812 } as const;

export const ACCOUNT_TAG = '@account';

export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A user name that does not exist on demoqa (never a real account). */
export function fakeUserName(): string {
  return `qa-nonexistent-${uniqueSuffix()}`;
}

/** A generated wrong password value (never the real value). */
export function wrongLoginValue(): string {
  return `qa-wrong-${uniqueSuffix()}`;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
