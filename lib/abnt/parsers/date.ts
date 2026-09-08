'use client';

import { ABNT_MONTHS } from '../constants';

export function normalizeMonth(input: string): string {
  const normalized = input.trim().toLowerCase();
  return ABNT_MONTHS[normalized] || input;
}

export function formatMonthYear(month?: string, year?: string): string {
  if (!month && !year) return '';
  if (month && year) {
    return `${normalizeMonth(month)} ${year}`;
  }
  return year || '';
}

export function formatAccessDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split(/[/\-.]/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const monthAbbr = ABNT_MONTHS[month] || month;
    return `${parseInt(day, 10)} ${monthAbbr} ${year}`;
  }
  return dateStr;
}

export function formatDayMonthYear(day: string, month: string, year: string): string {
  if (!day || !month || !year) return '';
  return `${parseInt(day, 10)} ${normalizeMonth(month)} ${year}`;
}
