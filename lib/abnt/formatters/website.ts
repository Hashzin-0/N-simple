'use client';

import { ABNTReference } from '../types';
import { formatAuthorsABNT } from '../parsers/author';

export function formatWebsite(ref: ABNTReference): string {
  const parts: string[] = [];

  if (ref.authors.length > 0) {
    parts.push(formatAuthorsABNT(ref.authors));
  } else if (ref.organization) {
    parts.push(ref.organization);
  }

  const title = ref.subtitle
    ? `${ref.title}: ${ref.subtitle}`
    : ref.title;
  parts.push(title);

  if (ref.year) parts.push(ref.year);

  if (ref.url) parts.push(`Disponível em: ${ref.url}`);

  if (ref.accessDate) parts.push(`Acesso em: ${ref.accessDate}`);

  return parts.join('. ') + '.';
}
