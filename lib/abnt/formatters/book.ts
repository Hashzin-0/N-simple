'use client';

import { ABNTReference } from '../types';
import { formatAuthorsABNT } from '../parsers/author';

export function formatBook(ref: ABNTReference): string {
  const parts: string[] = [];

  if (ref.authors.length > 0) {
    parts.push(formatAuthorsABNT(ref.authors));
  }

  const title = ref.subtitle
    ? `${ref.title}: ${ref.subtitle}`
    : ref.title;
  parts.push(title);

  if (ref.edition) parts.push(ref.edition);

  if (ref.location && ref.publisher) {
    parts.push(`${ref.location}: ${ref.publisher}`);
  }

  parts.push(ref.year);

  if (ref.pagesTotal) parts.push(`${ref.pagesTotal} p.`);

  return parts.join('. ') + '.';
}

export function formatBookChapter(ref: ABNTReference): string {
  const parts: string[] = [];

  if (ref.authors.length > 0) {
    parts.push(formatAuthorsABNT(ref.authors));
  }

  parts.push(ref.title);

  const bookTitle = ref.subtitle
    ? `${ref.bookTitle || ref.title}: ${ref.subtitle}`
    : (ref.bookTitle || ref.title);

  const bookAuthorStr = ref.bookAuthor
    ? typeof ref.bookAuthor === 'string'
      ? ref.bookAuthor
      : ''
    : '';

  if (bookAuthorStr) {
    parts.push(`In: ${bookAuthorStr}. ${bookTitle}`);
  } else {
    parts.push(`In: ${bookTitle}`);
  }

  if (ref.edition) parts.push(ref.edition);

  if (ref.location && ref.publisher) {
    parts.push(`${ref.location}: ${ref.publisher}`);
  }

  parts.push(ref.year);

  if (ref.pages) parts.push(`p. ${ref.pages}`);

  return parts.join('. ') + '.';
}

export function formatBookElectronic(ref: ABNTReference): string {
  const parts: string[] = [];

  if (ref.authors.length > 0) {
    parts.push(formatAuthorsABNT(ref.authors));
  }

  const title = ref.subtitle
    ? `${ref.title}: ${ref.subtitle}`
    : ref.title;
  parts.push(title);

  if (ref.edition) parts.push(ref.edition);

  if (ref.location && ref.publisher) {
    parts.push(`${ref.location}: ${ref.publisher}`);
  }

  parts.push(ref.year);

  if (ref.pagesTotal) parts.push(`${ref.pagesTotal} p.`);

  if (ref.url) parts.push(`Disponível em: ${ref.url}`);

  if (ref.accessDate) parts.push(`Acesso em: ${ref.accessDate}`);

  return parts.join('. ') + '.';
}
