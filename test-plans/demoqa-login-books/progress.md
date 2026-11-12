# Progress: demoqa-login-books

- 2026-11-12: built with `/e2e-agent https://demoqa.com/books login, list and search books log out`, as a second flow on the same website (the guest flow is in the demoqa folders).
- Accounts: the saved DemoQA accounts (app name demoqa-books in the credentials file), one per browser. Never shown in reports.
- Test cases TC-01 to TC-04 approved by the user (2026-11-12, 20:04 IST). Run confirmed by the user.
- First full run: 12 of 12 passed on Chromium, Firefox and WebKit.
- Quality review: one Major finding (a check that could print the user name if it failed). Fixed in TC-03; the user confirmed a re-run of TC-03.
- Re-run: Chromium and WebKit passed; Firefox timed out before the test started, while reading the credentials file. The failure investigator found a laptop stall (file in the OneDrive-synced folder), not a website or test problem (risk R-11). A Firefox re-run then passed (25.9 s). All 12 latest results: passed.
- Remaining Minor review notes: the user name locator is written twice, the signed-in page keeps its own copy of the page handle, and the login waits on the site's account request.
- Time taken: see the workbook Summary sheet.
- Run again: `.\scripts\run-e2e.ps1 -App demoqa-login-books -BaseUrl https://demoqa.com/`
