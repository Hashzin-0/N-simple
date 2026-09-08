'use client';

import { ABNTReference } from '../types';
import { formatAuthorsABNT } from '../parsers/author';

export function formatConference(ref: ABNTReference): string {
  const parts: string[] = [];

  if (ref.authors.length > 0) {
    parts.push(formatAuthorsABNT(ref.authors));
  }

  parts.push(ref.title);

  const eventParts: string[] = [];
  eventParts.push(ref.eventName || '');
  if (ref.eventNumber) eventParts.push(ref.eventNumber);
  if (ref.eventYear) eventParts.push(ref.eventYear);
  if (ref.eventLocation) eventParts.push(ref.eventLocation);
  parts.push(`In: ${eventParts.join(', ')}`);

  if (ref.bookTitle) parts.push(ref.bookTitle);

  if (ref.location && ref.publisher) {
    parts.push(`${ref.location}: ${ref.publisher}`);
  }

  parts.push(ref.year);

  if (ref.pages) parts.push(`p. ${ref.pages}`);

  return parts.join('. ') + '.';
}
