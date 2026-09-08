'use client';

import { Author } from '../types';

const PREFIXES = ['de', 'da', 'do', 'das', 'dos', 'van', 'von', 'di'];

export function parseAuthorString(input: string): Author {
  const parts = input.trim().split(/\s+/);
  if (parts.length === 0) return { surname: '', firstName: '' };

  let surnameParts: string[] = [];
  let firstNameParts: string[] = [];
  let foundSurnameEnd = false;

  for (let i = 0; i < parts.length; i++) {
    const lower = parts[i].toLowerCase();
    if (PREFIXES.includes(lower) && i < parts.length - 1) {
      surnameParts.push(parts[i]);
    } else if (!foundSurnameEnd && parts[i] === parts[i].toUpperCase() && parts[i].length > 1) {
      surnameParts.push(parts[i]);
    } else {
      foundSurnameEnd = true;
      firstNameParts.push(parts[i]);
    }
  }

  if (firstNameParts.length === 0 && surnameParts.length > 0) {
    firstNameParts = surnameParts.pop() ? [] : [];
  }

  return {
    surname: surnameParts.join(' '),
    firstName: firstNameParts.join(' '),
  };
}

export function formatAuthorABNT(author: Author): string {
  const surname = author.surname.toUpperCase();
  const firstName = author.firstName;
  return `${surname}, ${firstName}`;
}

export function formatAuthorsABNT(authors: Author[]): string {
  if (authors.length === 0) return '';

  if (authors.length <= 3) {
    return authors.map(formatAuthorABNT).join('; ');
  }

  return `${formatAuthorABNT(authors[0])} et al.`;
}
