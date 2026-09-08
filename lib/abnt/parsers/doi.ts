'use client';

import { DOI_REGEX, URL_REGEX } from '../constants';

export function isValidDOI(input: string): boolean {
  const cleaned = input.replace(/^https?:\/\/doi\.org\//i, '').trim();
  return DOI_REGEX.test(cleaned);
}

export function normalizeDOI(input: string): string {
  const cleaned = input.trim();
  if (cleaned.startsWith('http')) return cleaned;
  return `https://doi.org/${cleaned}`;
}

export function formatDOI(input: string): string {
  if (!input) return '';
  const normalized = normalizeDOI(input);
  return `DOI: ${normalized}`;
}

export function isValidURL(input: string): boolean {
  return URL_REGEX.test(input.trim());
}
