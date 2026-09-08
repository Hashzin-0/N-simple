'use client';

export type { ABNTReference, Author, ReferenceType, ReferenceTypeConfig } from './types';
export { REFERENCE_TYPES, ABNT_MONTHS, DOI_REGEX, URL_REGEX } from './constants';
export { parseAuthorString, formatAuthorABNT, formatAuthorsABNT } from './parsers/author';
export { normalizeMonth, formatMonthYear, formatAccessDate, formatDayMonthYear } from './parsers/date';
export { isValidDOI, normalizeDOI, formatDOI, isValidURL } from './parsers/doi';
export { formatReference, sortReferences, generateId, copyToClipboard } from './utils';
