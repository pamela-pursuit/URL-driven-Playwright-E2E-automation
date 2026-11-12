# Progress: demoqa-books (short flow, rebuilt 2026-11-12)

| Step | Status |
| --- | --- |
| Intake | Reused the three saved DemoQA accounts (one per browser) from the credentials file |
| Discovery | Done: login, Book Store, book page, Add To Your Collection, Profile, Delete Book, Logout observed |
| Test case | TC-01 "Log in, add a book to the collection, then log out", approved by the user 2026-11-12 |
| Code | pages/demoqa-books (login, book store, profile), fixtures/demoqa-books.fixture.ts, tests/demoqa-books/collection-flow.spec.ts |
| Run | 2026-11-12_13-19-45: 3 of 3 passed (Chromium 14.7 s, Firefox 27.9 s, WebKit 37.3 s; 48.6 s in parallel). No account values in reports |

Run: `='https://demoqa.com/'; ='demoqa-books'; npx playwright test tests/demoqa-books --project=chromium --project=firefox --project=webkit --workers=3`
