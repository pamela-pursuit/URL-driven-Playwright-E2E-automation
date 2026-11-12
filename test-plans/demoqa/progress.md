# Progress: demoqa

- 2026-11-12: built live from nothing with `/e2e-agent https://demoqa.com/books list and search books as a guest only, no sign-in, at most 3 test cases`.
- Scope: guest book list, search, book details. No sign-in and no changes to the website. No credentials are used.
- Test cases TC-01 to TC-03 approved by the user (2026-11-12, 19:45 IST).
- Run confirmed by the user ("Run all"): 9 of 9 passed on Chromium, Firefox and WebKit (run 2026-11-12_14-19-31).
- Quality review: Ready. Minor tidy-ups left for later: unused `bookDetailPage` fixture and `bookTitles()` helper, the two page objects import each other, and the detail-row locator could be tighter.
- Time taken: 14 min 27 s in total (11 min 58 s agent work, 2 min 29 s waiting for the user). Full log on the workbook's Summary sheet.
- Run again: `.\scripts\run-e2e.ps1 -App demoqa -BaseUrl https://demoqa.com/`
