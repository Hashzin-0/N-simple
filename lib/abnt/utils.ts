'use client';

import { ABNTReference } from './types';
import { formatBook, formatBookChapter, formatBookElectronic } from './formatters/book';
import { formatJournalArticle, formatJournalArticleOnline } from './formatters/journal';
import { formatNewspaperArticle, formatNewspaperArticleOnline } from './formatters/newspaper';
import { formatWebsite } from './formatters/website';
import { formatThesis } from './formatters/thesis';
import { formatConference } from './formatters/conference';
import { formatLegislation, formatTechnicalStandard, formatPatent } from './formatters/legislation';
import { formatAudiovisual } from './formatters/audiovisual';
import { formatAITool } from './formatters/ai';

const FORMATTERS: Record<string, (ref: ABNTReference) => string> = {
  book: formatBook,
  book_chapter: formatBookChapter,
  book_electronic: formatBookElectronic,
  journal_article: formatJournalArticle,
  journal_article_online: formatJournalArticleOnline,
  newspaper_article: formatNewspaperArticle,
  newspaper_article_online: formatNewspaperArticleOnline,
  website: formatWebsite,
  thesis: formatThesis,
  conference: formatConference,
  technical_standard: formatTechnicalStandard,
  legislation: formatLegislation,
  patent: formatPatent,
  audiovisual: formatAudiovisual,
  ai_tool: formatAITool,
};

export function formatReference(ref: ABNTReference): string {
  const formatter = FORMATTERS[ref.type];
  if (!formatter) return '';
  const result = formatter(ref);
  return cleanDoubleDots(cleanTrailingDot(result));
}

function cleanDoubleDots(text: string): string {
  return text.replace(/\.\./g, '.').replace(/,\./g, ',').replace(/\.,/g, '.');
}

function cleanTrailingDot(text: string): string {
  return text.replace(/\.\s*$/, '').trim();
}

export function sortReferences(refs: ABNTReference[]): ABNTReference[] {
  return [...refs].sort((a, b) => {
    const authorA = a.authors[0]?.surname || a.title || '';
    const authorB = b.authors[0]?.surname || b.title || '';
    return authorA.localeCompare(authorB, 'pt-BR');
  });
}

export function generateId(): string {
  return `ref_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  return Promise.resolve();
}
