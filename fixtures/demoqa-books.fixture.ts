import fs from 'node:fs';
import path from 'node:path';
import { test as base, expect, type BrowserContext, type Cookie, type Route } from '@playwright/test';
import { getAccount } from '../lib/credentials-store.cjs';
import { DemoqaAlerts } from '../pages/demoqa-books/alerts';
import { DemoqaBookDetailPage } from '../pages/demoqa-books/book-detail.page';
import { DemoqaBooksPage } from '../pages/demoqa-books/books.page';
import { DemoqaLoginPage } from '../pages/demoqa-books/login.page';
import { DemoqaProfilePage } from '../pages/demoqa-books/profile.page';
import { DemoqaRegisterPage } from '../pages/demoqa-books/register.page';
import {
  ACCOUNT_TAG,
  API_GLOB,
  DESKTOP_VIEWPORT,
  MESSAGES,
  NEVER_BLOCKED_HOSTS,
  OWN_BOOK_ISBNS,
  ROLE_BY_PROJECT,
  SESSION_COOKIES,
  THIRD_PARTY_BLOCKLIST,
  type OwnBook,
  type Role
} from '../test-data/demoqa-books.data';

const APP = 'demoqa-books';
const DEMOQA_HOST = /(^|\.)demoqa\.com$/;

export interface BrowserAccount {
  role: Role;
  userName: string;
  password: string;
}

export interface AccountSession {
  /** Signs in on the first call (one UI login per worker), then adds the cached cookies. */
  apply(context: BrowserContext): Promise<void>;
  /** UI login again and replace the cached cookies. */
  refresh(): Promise<void>;
  /**
   * Replaces the cached cookies with this context's demoqa.com session cookies. Call after any
   * other UI login: a new login revokes the previous token (P3), so the old cache is dead.
   */
  adopt(context: BrowserContext): Promise<void>;
  logins(): number;
}

export interface LoginCircuitBreaker {
  /** Throws when this browser's account was rejected earlier in this run (R-06). */
  ensureClosed(): void;
  recordRejection(): void;
}

export interface WrongPasswordBudget {
  /** K4: one wrong-password attempt per account per run; throws if already used. */
  consume(): void;
}

export interface OwnedBooks {
  /** Registers one of the suite's own books for this test and removes a leftover copy. */
  claim(book: OwnBook): Promise<void>;
  /** Setup add through the detail page; throws if the alert is not "Book added to your collection.". */
  addViaUi(book: OwnBook): Promise<void>;
}

export interface BooksApi {
  /** Answers the next GET /BookStore/v1/Books with the status; `fired` resolves when it was used. */
  failListWith(status: number): Promise<{ fired: Promise<void> }>;
}

export interface ApiLog {
  /** Requests seen so far by method and path (user-id segments replaced by <userID>). */
  count(method: string, path: string): number;
}

export interface PageErrors {
  mark(): void;
  sinceMark(): string[];
}

type Fixtures = {
  blockThirdParty: void;
  alerts: DemoqaAlerts;
  booksPage: DemoqaBooksPage;
  bookDetailPage: DemoqaBookDetailPage;
  loginPage: DemoqaLoginPage;
  registerPage: DemoqaRegisterPage;
  profilePage: DemoqaProfilePage;
  loginCircuitBreaker: LoginCircuitBreaker;
  wrongPasswordBudget: WrongPasswordBudget;
  accountLock: void;
  account: BrowserAccount;
  signedIn: { account: BrowserAccount };
  freshLogin: () => Promise<DemoqaProfilePage>;
  ownedBooks: OwnedBooks;
  apiLog: ApiLog;
  booksApi: BooksApi;
  pageErrors: PageErrors;
};

type WorkerFixtures = {
  browserAccount: BrowserAccount;
  accountSession: AccountSession;
};

/** K8: suffix match on the host; demoqa.com and reCAPTCHA are never matched. */
function isThirdParty(url: URL): boolean {
  const host = url.hostname;
  if (NEVER_BLOCKED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    return false;
  }
  return THIRD_PARTY_BLOCKLIST.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

const CONTENT_TYPE: Record<string, string> = {
  script: 'application/javascript',
  stylesheet: 'text/css',
  document: 'text/html',
  image: 'image/gif'
};

/** Fulfils third-party requests with an empty 200 (R-03). */
export async function blockThirdParty(context: BrowserContext): Promise<void> {
  await context.route(isThirdParty, (route: Route) =>
    route.fulfill({
      status: 200,
      body: '',
      contentType: CONTENT_TYPE[route.request().resourceType()] ?? 'text/plain'
    })
  );
}

/** Path with any user-id segment replaced; never query values. */
function maskedPath(url: URL): string {
  return url.pathname.replace(/^(\/Account\/v1\/User\/)[^/]+$/, '$1<userID>');
}

function runDirectoryOf(outputDir: string): string {
  return path.dirname(outputDir);
}

function markerPath(runDir: string, role: Role, suffix: string): string {
  return path.join(runDir, `.${APP}-${role}${suffix}`);
}

function circuitBreaker(runDir: string, role: Role): LoginCircuitBreaker {
  const marker = markerPath(runDir, role, '-login-rejected');
  return {
    ensureClosed: () => {
      if (fs.existsSync(marker)) {
        throw new Error(`Skipping sign-in: ${role} was rejected earlier in this run (lockout protection, R-06)`);
      }
    },
    recordRejection: () => {
      fs.mkdirSync(runDir, { recursive: true });
      fs.writeFileSync(marker, '');
    }
  };
}

function rejectedMessage(role: Role): string {
  return `${role} sign-in was rejected. Check the credential with: node scripts/credentials.mjs check --app ${APP}`;
}

/** The four demoqa.com session cookies of a context (kept in memory only, never logged). */
async function sessionCookiesOf(context: BrowserContext): Promise<Cookie[]> {
  return (await context.cookies()).filter(
    (cookie) => DEMOQA_HOST.test(cookie.domain.replace(/^\./, '')) && (SESSION_COOKIES as readonly string[]).includes(cookie.name)
  );
}

/** UI login in the given page's context; returns once /profile shows the signed-in state. */
async function signInThroughUi(
  loginPage: DemoqaLoginPage,
  profilePage: DemoqaProfilePage,
  account: BrowserAccount,
  breaker: LoginCircuitBreaker
): Promise<void> {
  breaker.ensureClosed();
  await loginPage.open();
  const outcome = await base.step(
    `Sign in as ${account.role}`,
    async () => loginPage.signIn(account.userName, account.password),
    { box: true }
  );
  if (outcome === 'rejected') {
    breaker.recordRejection();
    throw new Error(rejectedMessage(account.role));
  }
  if (outcome !== 'signed-in') {
    throw new Error(`${account.role} sign-in did not complete (outcome: ${outcome})`);
  }
  await profilePage.waitForSignedIn();
}

/** CSS mask over the signed-in user name and the login UserName input (K6c). */
const MASK_CSS =
  '#userName-value, #userForm #userName { background: #000 !important; color: #000 !important; }';

/** Lock owner is alive (signal 0 only checks existence). A dead or reused owner is taken over. */
function lockOwnerAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function tryAcquireLock(lockFile: string): boolean {
  try {
    fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' });
    return true;
  } catch {
    const owner = Number(fs.readFileSync(lockFile, 'utf8'));
    if (!lockOwnerAlive(owner)) {
      fs.writeFileSync(lockFile, String(process.pid));
      return true;
    }
    return false;
  }
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  blockThirdParty: [
    async ({ context }, use) => {
      await blockThirdParty(context);
      await use();
    },
    { auto: true }
  ],

  alerts: async ({ page }, use) => use(DemoqaAlerts.for(page)),
  booksPage: async ({ page }, use) => use(new DemoqaBooksPage(page)),
  bookDetailPage: async ({ page }, use) => use(new DemoqaBookDetailPage(page)),
  loginPage: async ({ page }, use) => use(new DemoqaLoginPage(page)),
  registerPage: async ({ page }, use) => use(new DemoqaRegisterPage(page)),
  profilePage: async ({ page }, use) => use(new DemoqaProfilePage(page)),

  // K1: accounts are read only here (credentials.md), for this browser's role only. A missing role
  // or field makes getAccount throw a descriptive error without values; the test fails (not skipped).
  browserAccount: [
    async ({}, use, workerInfo) => {
      const role = ROLE_BY_PROJECT[workerInfo.project.name];
      if (!role) {
        throw new Error(`No ${APP} account role for project "${workerInfo.project.name}"`);
      }
      const account = await getAccount(APP, role, { required: ['userName', 'password'] });
      await use({ role, userName: account.userName, password: account.password });
    },
    { scope: 'worker' }
  ],

  // K2: one UI login per worker; the four session cookies stay in memory only (never on disk).
  accountSession: [
    async ({ browser, browserAccount }, use, workerInfo) => {
      const breaker = circuitBreaker(runDirectoryOf(workerInfo.project.outputDir), browserAccount.role);
      let cached: Cookie[] | null = null;
      let logins = 0;
      const login = async () => {
        const context = await browser.newContext({ baseURL: workerInfo.project.use.baseURL, viewport: DESKTOP_VIEWPORT });
        try {
          await blockThirdParty(context);
          const page = await context.newPage();
          await signInThroughUi(new DemoqaLoginPage(page), new DemoqaProfilePage(page), browserAccount, breaker);
          logins += 1;
          cached = await sessionCookiesOf(context);
        } finally {
          await context.close();
        }
      };
      await use({
        apply: async (context) => {
          if (!cached) {
            await login();
          }
          await context.addCookies(cached ?? []);
        },
        refresh: login,
        adopt: async (context) => {
          const cookies = await sessionCookiesOf(context);
          // Without a token the next apply() signs in again instead of adding an empty session.
          cached = cookies.some((cookie) => cookie.name === 'token') ? cookies : null;
        },
        logins: () => logins
      });
      cached = null;
    },
    { scope: 'worker', timeout: 90_000 }
  ],

  // K3: per-role cross-process mutex (defence in depth; the account pass runs with one worker).
  accountLock: [
    async ({ browserAccount }, use, testInfo) => {
      const runDir = runDirectoryOf(testInfo.project.outputDir);
      fs.mkdirSync(runDir, { recursive: true });
      const lockFile = markerPath(runDir, browserAccount.role, '.lock');
      await expect
        .poll(() => tryAcquireLock(lockFile), {
          message: `Waiting for the ${browserAccount.role} account lock`,
          intervals: [250],
          timeout: 590_000
        })
        .toBe(true);
      try {
        await use();
      } finally {
        fs.rmSync(lockFile, { force: true });
      }
    },
    { timeout: 600_000 }
  ],

  account: async ({ browserAccount, accountLock, context }, use, testInfo) => {
    void accountLock;
    if (!testInfo.tags.includes(ACCOUNT_TAG)) {
      throw new Error('Test uses an account but is not tagged @account (the guest pass would run it in parallel)');
    }
    await context.addInitScript((css: string) => {
      const add = () => {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head ?? document.documentElement).appendChild(style);
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', add);
      } else {
        add();
      }
    }, MASK_CSS);
    // Section 3.10: only the single-book delete may reach the server.
    const blocked: string[] = [];
    await context.route(
      (url) => DEMOQA_HOST.test(url.hostname),
      async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.method() === 'DELETE' && url.pathname !== '/BookStore/v1/Book') {
          blocked.push(maskedPath(url));
          testInfo.annotations.push({ type: 'account-guard', description: `Blocked DELETE ${maskedPath(url)}` });
          await route.abort('blockedbyclient');
          return;
        }
        await route.fallback();
      }
    );
    await use(browserAccount);
    if (blocked.length > 0) {
      throw new Error(`Blocked a DELETE ${blocked[0]} (only single-book delete is allowed)`);
    }
  },

  loginCircuitBreaker: async ({ browserAccount }, use, testInfo) => {
    await use(circuitBreaker(runDirectoryOf(testInfo.project.outputDir), browserAccount.role));
  },

  wrongPasswordBudget: async ({ browserAccount }, use, testInfo) => {
    const runDir = runDirectoryOf(testInfo.project.outputDir);
    const marker = markerPath(runDir, browserAccount.role, '-wrong-password-used');
    await use({
      consume: () => {
        if (fs.existsSync(marker)) {
          throw new Error(
            `${browserAccount.role}: the one wrong-password attempt of this run was already used (R-06); not trying again`
          );
        }
        fs.mkdirSync(runDir, { recursive: true });
        fs.writeFileSync(marker, '');
      }
    });
  },

  // A new login revokes the previous token (P3); Logout is client-side only (the token stays valid),
  // so no logout on teardown: the context is discarded. The session is judged by the
  // GET /Account/v1/User status (openSession), never by a visible Logout button.
  signedIn: [
    async ({ account, accountSession, context, profilePage }, use, testInfo) => {
      await accountSession.apply(context);
      let state = await profilePage.openSession();
      if (state !== 'signed-in') {
        testInfo.annotations.push({ type: 'session-refreshed', description: `${account.role}: ${state}` });
        await accountSession.refresh();
        await accountSession.apply(context);
        state = await profilePage.openSession();
        if (state !== 'signed-in') {
          throw new Error(`${account.role} session could not be established (${state})`);
        }
      }
      await use({ account });
    },
    { timeout: 60_000 }
  ],

  // A new login revokes the previous token (P3): the cached worker session is replaced with this one.
  freshLogin: async ({ account, accountSession, context, loginPage, profilePage, loginCircuitBreaker }, use) => {
    await use(async () => {
      await signInThroughUi(loginPage, profilePage, account, loginCircuitBreaker);
      await accountSession.adopt(context);
      return profilePage;
    });
  },

  // K5: own books only, removed before and after (also after a failure); guarded in removeOwnBook.
  ownedBooks: [
    async ({ account, accountSession, context, profilePage, bookDetailPage }, use, testInfo) => {
      const claimed: OwnBook[] = [];
      // Leaves /profile loaded with its collection rows final (openSession waits for them).
      const ensureSignedIn = async () => {
        let state = await profilePage.openSession();
        if (state === 'signed-in') {
          return;
        }
        await accountSession.apply(context);
        state = await profilePage.openSession();
        if (state === 'signed-in') {
          return;
        }
        testInfo.annotations.push({ type: 'session-refreshed', description: `${account.role}: ${state}` });
        await accountSession.refresh();
        await accountSession.apply(context);
        state = await profilePage.openSession();
        if (state !== 'signed-in') {
          throw new Error(`${account.role} session could not be established for collection cleanup (${state})`);
        }
      };
      const remove = async (book: OwnBook, phase: string) => {
        const { removed } = await profilePage.removeOwnBook(book);
        if (removed) {
          testInfo.annotations.push({ type: 'cleanup', description: `${phase}: removed "${book.title}"` });
        }
      };
      await use({
        claim: async (book) => {
          if (!OWN_BOOK_ISBNS.includes(book.isbn)) {
            throw new Error(`"${book.title}" is not one of the suite's own books`);
          }
          await ensureSignedIn();
          await remove(book, 'setup');
          if (!claimed.some((own) => own.isbn === book.isbn)) {
            claimed.push(book);
          }
        },
        addViaUi: async (book) => {
          await bookDetailPage.open(book.isbn);
          const { message } = await bookDetailPage.addToCollection();
          if (message !== MESSAGES.bookAdded) {
            throw new Error(`Setup could not add "${book.title}": ${message}`);
          }
        }
      });
      if (claimed.length === 0) {
        return;
      }
      await ensureSignedIn();
      for (const book of claimed) {
        await remove(book, 'teardown');
      }
    },
    { timeout: 90_000 }
  ],

  apiLog: async ({ page }, use) => {
    const seen: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (DEMOQA_HOST.test(url.hostname) && /^\/(Account|BookStore)\//.test(url.pathname)) {
        seen.push(`${request.method()} ${maskedPath(url)}`);
      }
    });
    await use({ count: (method, requestPath) => seen.filter((entry) => entry === `${method} ${requestPath}`).length });
  },

  booksApi: async ({ page }, use) => {
    await use({
      failListWith: async (status) => {
        let resolveFired!: () => void;
        const fired = new Promise<void>((resolve) => {
          resolveFired = resolve;
        });
        let used = false;
        await page.route(API_GLOB.booksList, async (route) => {
          if (used || route.request().method() !== 'GET') {
            await route.continue();
            return;
          }
          used = true;
          await route.fulfill({ status, body: '{}', contentType: 'application/json' });
          resolveFired();
        });
        return { fired };
      }
    });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  },

  pageErrors: async ({ page }, use, testInfo) => {
    const errors: string[] = [];
    let markIndex = 0;
    page.on('pageerror', (error) => errors.push(error.message));
    await use({
      mark: () => {
        markIndex = errors.length;
      },
      sinceMark: () => errors.slice(markIndex)
    });
    // Evidence for a failed test (e.g. DEF-001): uncaught page errors since the mark. App errors only.
    if (testInfo.status !== testInfo.expectedStatus && errors.length > markIndex) {
      testInfo.annotations.push({ type: 'page-errors', description: errors.slice(markIndex).join(' | ') });
    }
  }
});

export { expect };

/** Annotation for first-run observations. Never pass account values. */
export function recordObservation(type: string, description: string): void {
  test.info().annotations.push({ type, description });
}

/** Names of the demoqa.com session cookies present in the context. Names only, never values. */
export async function sessionCookieNames(context: BrowserContext): Promise<string[]> {
  const names = (await context.cookies())
    .filter((cookie) => DEMOQA_HOST.test(cookie.domain.replace(/^\./, '')))
    .map((cookie) => cookie.name);
  return SESSION_COOKIES.filter((name) => names.includes(name));
}
