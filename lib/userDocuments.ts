import * as cheerio from 'cheerio';
import PDFParser from 'pdf2json';

export interface TopicSection {
  topic: string;
  relevantText: string;
}

export interface UserDocumentSource {
  url: string;
  title: string;
  contentType: 'html' | 'pdf';
  fullText: string;
  topicSections: TopicSection[];
  abntCitation: string;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractTitleFromHtml($: cheerio.CheerioAPI): string {
  const ogTitle = $('meta[property="og:title"]').attr('content');
  if (ogTitle) return normalizeText(ogTitle);

  const metaTitle = $('meta[name="title"]').attr('content');
  if (metaTitle) return normalizeText(metaTitle);

  const h1 = $('h1').first().text();
  if (h1 && h1.trim().length > 3) return normalizeText(h1);

  const title = $('title').text();
  return normalizeText(title) || 'Documento sem título';
}

function extractMainTextFromHtml($: cheerio.CheerioAPI): string {
  $('script, style, nav, footer, header, aside, .sidebar, .menu, .ad, .advertisement, .cookie, .popup').remove();

  const article = $('article').text();
  if (article && article.trim().length > 100) return normalizeText(article);

  const main = $('main').text();
  if (main && main.trim().length > 100) return normalizeText(main);

  const content = $('[role="main"], .content, .post-content, .article-body, .entry-content').text();
  if (content && content.trim().length > 100) return normalizeText(content);

  return normalizeText($('body').text() || '');
}

function extractAuthorFromHtml($: cheerio.CheerioAPI): string {
  const metaAuthor = $('meta[name="author"]').attr('content');
  if (metaAuthor) return normalizeText(metaAuthor);

  const ogAuthor = $('meta[property="article:author"]').attr('content');
  if (ogAuthor) return normalizeText(ogAuthor);

  const byline = $('.author, .byline, .post-author, .article-author').first().text();
  if (byline) return normalizeText(byline);

  return 'Autor não identificado';
}

function extractYearFromText(text: string): number {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : new Date().getFullYear();
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30);
}

function extractTopicSections(fullText: string, topics: string[]): TopicSection[] {
  const paragraphs = splitIntoParagraphs(fullText);
  const sections: TopicSection[] = [];

  for (const topic of topics) {
    const topicWords = topic
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const scored = paragraphs.map((para) => {
      const lower = para.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      let score = 0;
      for (const word of topicWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = lower.match(regex);
        if (matches) score += matches.length;
      }
      return { para, score };
    });

    const relevant = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((s) => s.para);

    if (relevant.length > 0) {
      sections.push({
        topic,
        relevantText: relevant.join('\n\n'),
      });
    } else {
      const fallback = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map((s) => s.para);

      sections.push({
        topic,
        relevantText: fallback.length > 0
          ? fallback.join('\n\n')
          : 'Conteúdo específico não encontrado neste documento para este tópico.',
      });
    }
  }

  return sections;
}

function formatAbntCitation(
  author: string,
  title: string,
  year: number,
  url: string
): string {
  const upperAuthor = author.toUpperCase().replace(/;/g, ';');
  return `${upperAuthor}. ${title}. ${year}. Disponível em: ${url}.`;
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).replace(/\s+\S*$/, '') + '...';
}

async function fetchHtmlDocument(
  url: string,
  topics: string[]
): Promise<UserDocumentSource | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn(`[UserDocs] HTTP ${response.status} for ${url}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = extractTitleFromHtml($);
    const author = extractAuthorFromHtml($);
    const fullText = extractMainTextFromHtml($);
    const year = extractYearFromText(`${title} ${fullText}`);
    const topicSections = extractTopicSections(fullText, topics);

    return {
      url,
      title,
      contentType: 'html',
      fullText: truncateText(fullText, 5000),
      topicSections,
      abntCitation: formatAbntCitation(author, title, year, url),
    };
  } catch (error) {
    console.warn(`[UserDocs] Failed to fetch HTML from ${url}:`, error);
    return null;
  }
}

async function fetchPdfDocument(
  url: string,
  topics: string[]
): Promise<UserDocumentSource | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/pdf,*/*',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.warn(`[UserDocs] HTTP ${response.status} for PDF ${url}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parser = new PDFParser(undefined, true);

    const { text, meta } = await new Promise<{
      text: string;
      meta: Record<string, unknown>;
    }>((resolve, reject) => {
      parser.on('pdfParser_dataError', (errData: Error | { parserError: Error }) => {
        reject(errData instanceof Error ? errData : errData.parserError);
      });
      parser.on('pdfParser_dataReady', (pdfData: any) => {
        const text = (parser as any).getRawTextContent() as string;
        const meta = (pdfData?.Meta || {}) as Record<string, unknown>;
        resolve({ text, meta });
      });
      parser.parseBuffer(buffer);
    });

    if (text.trim().length < 50) {
      console.warn(`[UserDocs] PDF too short or empty: ${url}`);
      return null;
    }

    const title = (meta.Title as string) || url.split('/').pop()?.replace(/\.pdf$/i, '') || 'Documento PDF';
    const author = (meta.Author as string) || 'Autor não identificado';
    const year = meta.CreationDate
      ? extractYearFromText(String(meta.CreationDate))
      : extractYearFromText(text);
    const topicSections = extractTopicSections(text, topics);

    return {
      url,
      title: normalizeText(title),
      contentType: 'pdf',
      fullText: truncateText(text, 5000),
      topicSections,
      abntCitation: formatAbntCitation(author, normalizeText(title), year, url),
    };
  } catch (error) {
    console.warn(`[UserDocs] Failed to fetch PDF from ${url}:`, error);
    return null;
  }
}

function detectContentType(
  contentType: string | null,
  url: string
): 'html' | 'pdf' {
  if (contentType?.includes('pdf')) return 'pdf';
  if (url.toLowerCase().endsWith('.pdf')) return 'pdf';
  return 'html';
}

export async function fetchUserDocuments(
  urls: string[],
  topics: string[]
): Promise<UserDocumentSource[]> {
  if (urls.length === 0) return [];

  const fetchPromises = urls.map(async (url) => {
    try {
      const headResponse = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(10000),
      });

      const contentType = headResponse.headers.get('content-type');
      const type = detectContentType(contentType, url);

      if (type === 'pdf') {
        return fetchPdfDocument(url, topics);
      }
      return fetchHtmlDocument(url, topics);
    } catch {
      try {
        return fetchHtmlDocument(url, topics);
      } catch {
        console.warn(`[UserDocs] Failed to fetch ${url}`);
        return null;
      }
    }
  });

  const results = await Promise.allSettled(fetchPromises);
  const documents: UserDocumentSource[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      documents.push(result.value);
    }
  }

  return documents;
}
