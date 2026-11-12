# Intake: demoqa-login-books

- Date: 2026-11-12
- URL: https://demoqa.com/books
- App slug: demoqa-login-books (a second flow on the same website; the guest flow lives in the demoqa folders)
- Flow requested: log in, list and search books, log out
- Out of scope: registration, changing the book collection, deleting the account, anything that changes data
- Accounts: the saved DemoQA accounts in credentials/credentials.xlsx, stored under the app name "demoqa-books":
  existingUser (Chromium), firefoxUser (Firefox), webkitUser (WebKit); fields userName, password.
  Checked with `credentials.mjs check` (masked); no values recorded here.
- Reuse: book list and search page objects from pages/demoqa/.
