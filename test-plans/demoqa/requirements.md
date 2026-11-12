# demoqa - Requirements (Book Store, guest only)

Sources: `intake.md` (user request) and `discovery.md` (what was seen on the site on 2026-11-12).
Labels: **Confirmed (user)**, **Observed (discovery)**, **Assumed**.

## 1. Requirement Summary

| Ref | Requirement | Source |
|---|---|---|
| REQ-01 | A guest (not signed in) opens the Book Store and sees a table of books with the columns Image, Title, Author and Publisher. 8 books are listed on one page. | Confirmed (user): guest list in scope. Observed (discovery, Book list) |
| REQ-02 | Typing in the "Type to search" box filters the list while typing. Upper and lower case give the same result, author names also match, and clearing the box brings all books back. | Confirmed (user): search in scope. Observed (discovery, Search box) |
| REQ-03 | A guest clicks a book title, sees that book's details (ISBN, title, sub title, author, publisher, total pages, description, website), and "Back To Book Store" returns to the full list. | Observed (discovery, Book detail) |

Size limit: at most 3 test cases. **Confirmed (user)**

## 2. Assumptions

- **ASSUMPTION-01:** The 8 books listed during discovery stay the same on the public site. Tests check known titles such as "Git Pocket Guide", not exact page layout. **Assumed**
- **ASSUMPTION-02:** When a search finds nothing, the expected result is an empty table and the "Page 1 of 0" text, because that is what the site shows today. No message is checked. **Assumed** (based on Observed behaviour)
- **ASSUMPTION-03:** Search matches part of the title or author, ignoring case. Publisher matching was not tried and is not tested. **Assumed** (title and author Observed)
- **ASSUMPTION-04:** Every test case runs on Chromium, Firefox and WebKit (project rule: websites must work in every browser), on desktop at the default window size. **Confirmed project rule**

## 3. Missing Acceptance Criteria

- No message is defined for a search with no matches. The site shows only "Page 1 of 0".
- Which fields search should match (title, author, publisher, ISBN) is not stated.
- Rules for spaces, special characters or very long search text are not stated.
- Paging rules (rows per page, more than one page) are not stated. Only one page was seen.
- Whether the search text should be kept after visiting a book and going back is not stated.

## 4. Ambiguities and Clarification Questions

1. Should a search with no matches show a "no results" message? **Non-blocking.** Proceed with ASSUMPTION-02 and record the gap.
2. Should search also match publisher or ISBN? **Non-blocking.** Test title and author only (ASSUMPTION-03).
3. Is the book detail check (REQ-03) wanted within the 3 test cases? **Non-blocking.** It was seen as part of browsing as a guest and changes nothing, so it is included.

No Blocking questions.

## 5. Testing Risks

- Shared public demo site: the book list or page could change, or the site could be slow or down at any time.
- Books load after the page opens (about 2 seconds). Tests must wait for a book title to appear.
- An ad panel sits on the right side. It did not cover the table at the default size but could on other sizes or load slowly.
- The search box and its search button have no accessible name, so the box is found by its placeholder text.
- Detail values share one element id, so they must be checked within their own row.

## 6. Out of Scope / Unsafe Actions

- Sign-in, registration and the Login button. **Confirmed (user)**
- Adding or removing books in a collection, the profile page and anything that changes data. **Confirmed (user)**
- Mobile sizes and accessibility checks. **Assumed** (not requested)

## 7. Credential Needs

None. Guest only, no credentials file is used. **Confirmed (user, intake)**
