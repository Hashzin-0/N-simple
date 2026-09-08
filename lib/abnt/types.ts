'use client';

export type ReferenceType =
  | 'book'
  | 'book_chapter'
  | 'book_electronic'
  | 'journal_article'
  | 'journal_article_online'
  | 'newspaper_article'
  | 'newspaper_article_online'
  | 'website'
  | 'thesis'
  | 'conference'
  | 'technical_standard'
  | 'legislation'
  | 'patent'
  | 'audiovisual'
  | 'ai_tool';

export interface Author {
  surname: string;
  firstName: string;
}

export interface ABNTReference {
  id: string;
  type: ReferenceType;
  authors: Author[];
  title: string;
  subtitle?: string;
  edition?: string;
  location?: string;
  publisher?: string;
  year: string;
  month?: string;
  volume?: string;
  number?: string;
  pages?: string;
  doi?: string;
  url?: string;
  accessDate?: string;
  journalTitle?: string;
  journalSubtitle?: string;
  tomo?: string;
  organization?: string;
  translator?: string;
  editor?: string;
  advisor?: string;
  degree?: string;
  institution?: string;
  eventNumber?: string;
  eventName?: string;
  eventLocation?: string;
  eventYear?: string;
  patentNumber?: string;
  inventor?: string;
  filingDate?: string;
  grantDate?: string;
  legislationType?: string;
  legislationNumber?: string;
  legislationYear?: string;
  legislationSource?: string;
  legislationDate?: string;
  legislationEmenta?: string;
  standardNumber?: string;
  standardOrganization?: string;
  standardYear?: string;
  audiovisualType?: 'video' | 'podcast' | 'audio' | 'image';
  platform?: string;
  duration?: string;
  aiModel?: string;
  aiVersion?: string;
  aiLocation?: string;
  description?: string;
  pagesTotal?: string;
  series?: string;
  isbn?: string;
  issn?: string;
  notes?: string;
  bookTitle?: string;
  bookAuthor?: string;
  date?: string;
  section?: string;
}

export interface ReferenceTypeConfig {
  id: ReferenceType;
  label: string;
  description: string;
  icon: string;
  requiredFields: string[];
  optionalFields: string[];
}
