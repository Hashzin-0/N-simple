'use client';

import { ABNTReference } from '../types';
import { formatAuthorsABNT } from '../parsers/author';

export function formatJournalArticle(ref: ABNTReference): string {
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

  const volumeParts: string[] = [];
  if (ref.volume) volumeParts.push(`v. ${ref.volume}`);
  if (ref.number) volumeParts.push(`n. ${ref.number}`);
  if (ref.tomo) volumeParts.push(`t. ${ref.tomo}`);
  if (volumeParts.length > 0) parts.push(volumeParts.join(', '));

  if (ref.pages) parts.push(`p. ${ref.pages}`);

  if (ref.month && ref.year) {
    parts.push(`${ref.month} ${ref.year}`);
  } else {
    parts.push(ref.year);
  }

  return parts.join(', ') + '.';
}

export function formatJournalArticleOnline(ref: ABNTReference): string {
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

  const volumeParts: string[] = [];
  if (ref.volume) volumeParts.push(`v. ${ref.volume}`);
  if (ref.number) volumeParts.push(`n. ${ref.number}`);
  if (ref.tomo) volumeParts.push(`t. ${ref.tomo}`);
  if (volumeParts.length > 0) parts.push(volumeParts.join(', '));

  if (ref.pages) parts.push(`p. ${ref.pages}`);

  if (ref.month && ref.year) {
    parts.push(`${ref.month} ${ref.year}`);
  } else {
    parts.push(ref.year);
  }

  if (ref.doi) parts.push(`DOI: ${ref.doi}`);

  if (ref.url) parts.push(`Disponível em: ${ref.url}`);

  if (ref.accessDate) parts.push(`Acesso em: ${ref.accessDate}`);

  return parts.join(', ') + '.';
}
