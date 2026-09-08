'use client';

import { ABNTReference } from '../types';
import { formatAuthorsABNT } from '../parsers/author';

export function formatThesis(ref: ABNTReference): string {
  const parts: string[] = [];

  if (ref.authors.length > 0) {
    parts.push(formatAuthorsABNT(ref.authors));
  }

  const title = ref.subtitle
    ? `${ref.title}: ${ref.subtitle}`
    : ref.title;
  parts.push(title);

  if (ref.year) parts.push(ref.year);

  if (ref.degree) parts.push(ref.degree);

  if (ref.institution) parts.push(ref.institution);

  if (ref.location) parts.push(ref.location);

  return parts.join('. ') + '.';
}
