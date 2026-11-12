// Static, read-only data from test-plans/demoqa/scenarios.json (guest only, nothing is changed).
export const SEARCH_MATCH = 'Git';
export const SEARCH_NO_MATCH = 'zzzz';

export const BOOK = {
  title: 'Git Pocket Guide',
  author: 'Richard E. Silverman',
  publisher: "O'Reilly Media"
} as const;

export const KNOWN_TITLES = ['Git Pocket Guide', 'Understanding ECMAScript 6'] as const;

export const EXPECTED_BOOK_COUNT = 8;

export const COLUMNS = ['Image', 'Title', 'Author', 'Publisher'] as const;

export const PAGER = {
  full: 'Page 1 of 1',
  empty: 'Page 1 of 0'
} as const;
