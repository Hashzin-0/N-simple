'use client';

import { ABNTReference } from '../types';
import { formatAuthorsABNT } from '../parsers/author';

export function formatNewspaperArticle(ref: ABNTReference): string {
  const parts: string[] = [];

  if (ref.authors.length > 0) {
    parts.push(formatAuthorsABNT(ref.authors));
  }

  const title = ref.subtitle
    ? `${ref.title}: ${ref.subtitle}`
    : ref.title;
  parts.push(title);

  if (ref.journalTitle) parts.push(ref.journalTitle);

  if (ref.location) parts.push(ref.location);

  if (ref.pages) parts.push(`p. ${ref.pages}`);

  if (ref.date) parts.push(ref.date);

  return parts.join(', ') + '.';
}

export function formatNewspaperArticleOnline(ref: ABNTReference): string {
  const parts: string[] = [];

  if (ref.authors.length > 0) {
    parts.push(formatAuthorsABNT(ref.authors));
  }

  const title = ref.subtitle
    ? `${ref.title}: ${ref.subtitle}`
    : ref.title;
  parts.push(title);

  if (ref.journalTitle) parts.push(ref.journalTitle);

  if (ref.location) parts.push(ref.location);

  if (ref.date) parts.push(ref.date);

  if (ref.url) parts.push(`Disponível em: ${ref.url}`);

  if (ref.accessDate) parts.push(`Acesso em: ${ref.accessDate}`);

  return parts.join(', ') + '.';
}
