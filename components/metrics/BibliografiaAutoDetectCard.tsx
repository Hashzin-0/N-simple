'use client';

import React, { useState, useCallback, useRef } from 'react';
import { BookOpen, Link, FileText, Search, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import CalculationIsland from '@/components/CalculationIsland';
import CalculationMemoryPanel from '@/components/CalculationMemoryPanel';
import { formatReference } from '@/lib/abnt/utils';
import { ABNTReference, ReferenceType } from '@/lib/abnt/types';
import { cn } from '@/lib/utils';
import { ElasticText } from '@/components/godui/elastic-text';

interface BibliografiaAutoDetectProps {
  onReferenceSelected: (ref: ABNTReference) => void;
  initialUrl?: string;
}

interface ExtractedMetadata {
  authors: string[];
  title: string;
  subtitle: string;
  year: number | null;
  publication: string;
  url: string;
  accessDate: string;
  type: ReferenceType;
}

function extractMetadataFromHtml(html: string, url: string): ExtractedMetadata | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    if (doc.querySelector('html') === null) return null;

    const extractText = (selector: string): string => {
      const el = doc.querySelector(selector);
      return el?.textContent?.trim() || '';
    };

    const extractAttribute = (selector: string, attr: string): string => {
      const el = doc.querySelector(selector);
      return el?.getAttribute(attr) || '';
    };

    // Try Open Graph tags first
    const ogTitle = extractAttribute('meta[property="og:title"]', 'content');
    const ogDescription = extractAttribute('meta[property="og:description"]', 'content');
    const ogAuthor = extractAttribute('meta[property="og:author"]', 'content');

    // Try Twitter Cards
    const twitterTitle = extractAttribute('meta[name="twitter:title"]', 'content');
    const twitterDescription = extractAttribute('meta[name="twitter:description"]', 'content');
    const twitterAuthor = extractAttribute('meta[name="twitter:author"]', 'content');

    const title = twitterTitle || ogTitle || doc.title || 'Título não encontrado';
    const description = twitterDescription || ogDescription || '';

    // Extract author from meta tags or fallback
    let authors: string[] = [];
    const authorMeta = extractAttribute('meta[name="author"]', 'content');
    const ogAuthorContent = ogAuthor || twitterAuthor;

    if (authorMeta) {
      authors = authorMeta.split(/[,&]/).map((a: string) => a.trim()).filter((a: string) => a.length > 0);
    } else if (ogAuthorContent) {
      authors = [ogAuthorContent];
    }

    // Extract year - try multiple patterns
    let year: number | null = null;
    const yearMatch = description.match(/\b(19|20)\d{2}\b/) || title.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      year = parseInt(yearMatch[0], 10);
    }
    const ogDate = extractAttribute('meta[property="og:date"]', 'content');
    if (!year && ogDate) {
      const dateMatch = ogDate.match(/\b(19|20)\d{2}\b/);
      if (dateMatch) year = parseInt(dateMatch[0], 10);
    }

    // Try to determine publication/journal from meta
    const publication = extractAttribute('meta[property="og:site_name"]', 'content') ||
                       extractText('meta[name="citation_journal_title"]') ||
                       extractText('meta[name="dc.title"]');

    // Determine source type based on URL
    let type: ReferenceType = 'website';
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('doi.org') || lowerUrl.includes('/doi/')) {
      type = 'journal_article';
    } else if (lowerUrl.includes('conference') || lowerUrl.includes('simp')) {
      type = 'conference';
    } else if (lowerUrl.includes('teses') || lowerUrl.includes('dissertacao')) {
      type = 'thesis';
    } else if (lowerUrl.includes('legislacao') || lowerUrl.includes('lei') || lowerUrl.includes('decreto')) {
      type = 'legislation';
    } else if (lowerUrl.includes('.pdf')) {
      type = 'thesis';
    }

    const accessDate = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    return {
      authors: authors.length > 0 ? authors : ['Autor não identificado'],
      title,
      subtitle: description,
      year,
      publication: publication || '',
      url,
      accessDate,
      type,
    };
  } catch (error) {
    console.error('Error extracting metadata from HTML:', error);
    return null;
  }
}

export default function BibliografiaAutoDetectCard({ onReferenceSelected, initialUrl }: BibliografiaAutoDetectProps) {
  const { isDark } = useTheme();
  const [showCalc, setShowCalc] = useState(false);
  const [status, setStatus] = useState<'idle' | 'scraping' | 'success' | 'error'>('idle');
  const [metadata, setMetadata] = useState<ExtractedMetadata | null>(null);
  const [inputValue, setInputValue] = useState<string>(initialUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    setMetadata(null);
    setStatus('idle');
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('scraping');

    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result ? ev.target.result.toString() : '';
        const yearMatch = text.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? parseInt(yearMatch[0], 10) : null;
        const accessDate = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

        setMetadata({
          authors: ['Autor não identificado'],
          title: 'Extração de PDF (metadata limitada)',
          subtitle: text.substring(0, 200),
          year,
          publication: '',
          url: file.name,
          accessDate,
          type: 'thesis',
        });
        setStatus('success');
      };
      reader.readAsText(file);
    } else {
      setMetadata({
        authors: ['Autor não identificado'],
        title: file.name,
        subtitle: '',
        year: null,
        publication: '',
        url: file.name,
        accessDate: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
        type: 'website',
      });
      setStatus('success');
    }
  }, []);

  const handleScrape = useCallback(async () => {
    if (!inputValue.trim()) return;

    setStatus('scraping');
    setMetadata(null);

    try {
      const response = await fetch(inputValue, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AgronômicaN-Pro/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error('Não foi possível acessar o URL.');
      }

      const html = await response.text();
      const extracted = extractMetadataFromHtml(html, inputValue);

      if (!extracted) {
        throw new Error('Não foi possível extrair metadados.');
      }

      setMetadata(extracted);
      setStatus('success');
    } catch (err: unknown) {
      console.error('Scraping error:', err);
      setStatus('error');
    }
  }, [inputValue]);

  const buildABNTRef = useCallback((meta: ExtractedMetadata): ABNTReference => {
    return {
      id: `auto_${Date.now()}`,
      type: meta.type,
      authors: meta.authors.map((a: string) => ({
        surname: a.split(' ').pop() || a,
        firstName: a.replace(a.split(' ').pop() || a, '').trim(),
      })),
      title: meta.title,
      subtitle: meta.subtitle || undefined,
      year: String(meta.year ?? new Date().getFullYear()),
      url: meta.url || undefined,
      accessDate: meta.accessDate || undefined,
      journalTitle: meta.publication || undefined,
    };
  }, []);

  const formattedRef = metadata ? formatReference(buildABNTRef(metadata)) : null;

  const handleSelectReference = useCallback(() => {
    if (!metadata) return;
    onReferenceSelected(buildABNTRef(metadata));
  }, [metadata, buildABNTRef, onReferenceSelected]);

  return (
    <div className="relative bg-white dark:bg-[#1C201A] rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] p-5 shadow-sm transition-colors" id="bibliography_autodetect">
      <CalculationIsland
        isVisible={showCalc}
        onToggle={() => setShowCalc(!showCalc)}
        accentColor="#5A5A40"
        darkAccentColor="#9CB386"
        isDark={isDark}
      />
      <div className="space-y-4">
        {/* Input Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-5 w-5 text-[#5A5A40] dark:text-[#9CB386]" />
            <ElasticText className="text-[10px] font-bold text-[#8C897E] dark:text-[#9EA399] uppercase block" mode="auto">
              Auto-detecção ABNT
            </ElasticText>
          </div>
          <p className="text-xs text-[#8C897E] dark:text-[#9EA399] mb-3">
            Cole um link ou selecione um arquivo. O sistema extrai e formata automaticamente.
          </p>
          <div className="relative">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C897E] dark:text-[#9EA399]" />
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="https://doi.org/10.xxxx... ou site do artigo"
                  className={cn(
                    'w-full pl-10 pr-4 py-3 rounded-xl border text-xs focus:outline-none focus:border-[#5A5A40] transition-all',
                    isDark
                      ? 'bg-[#161A14] border-[#3D3D3D] text-[#E8E6DF] placeholder:text-[#5A5A40]/50'
                      : 'bg-white border-[#D5D4D0] text-[#3D3D3D] placeholder:text-[#8C897E]/50',
                    status === 'scraping' && 'opacity-60',
                    status === 'error' && 'border-red-400'
                  )}
                  disabled={status === 'scraping'}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleScrape(); }}
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'p-3 rounded-xl border transition-all shrink-0',
                  isDark
                    ? 'bg-[#161A14] border-[#3D3D3D] text-[#9CB386] hover:bg-[#232821]'
                    : 'bg-[#F9F8F6] border-[#D5D4D0] text-[#5A5A40] hover:bg-[#F0EDE5]'
                )}
                title="Carregar arquivo (PDF, DOC)"
              >
                <FileText className="h-4 w-4" />
              </button>
              <button
                onClick={handleScrape}
                disabled={status === 'scraping' || !inputValue.trim()}
                className={cn(
                  'p-3 rounded-xl transition-all shrink-0 shadow-sm',
                  status === 'scraping'
                    ? 'bg-[#8C897E] text-white'
                    : 'bg-[#5A5A40] text-white hover:bg-[#7A763A] active:scale-95',
                  (!inputValue.trim() || status === 'scraping') && 'opacity-50 cursor-not-allowed'
                )}
                title="Buscar metadados"
              >
                {status === 'scraping' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {status === 'scraping' && (
          <div className={cn(
            'flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium',
            isDark ? 'bg-[#232821] text-[#9CB386]' : 'bg-[#F0EDE5] text-[#5A5A40]'
          )}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Extraindo metadados do link...
          </div>
        )}

        {/* Success */}
        {status === 'success' && metadata && (
          <div className="space-y-3">
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
              isDark ? 'bg-[#232821] text-[#9CB386]' : 'bg-[#F0EDE5] text-[#5A5A40]'
            )}>
              <CheckCircle className="h-3.5 w-3.5 shrink-0" />
              Metadados extraídos com sucesso
            </div>

            {/* Extracted fields preview */}
            <div className={cn(
              'grid grid-cols-2 gap-3 p-3 rounded-xl border',
              isDark ? 'bg-[#232821] border-[#2C3328]' : 'bg-[#F9F8F6] border-[#E5E2D9]'
            )}>
              {metadata.authors.length > 0 && metadata.authors[0] !== 'Autor não identificado' && (
                <div className="col-span-2">
                  <span className="text-[9px] font-bold text-[#8C897E] dark:text-[#9EA399] uppercase">Autor</span>
                  <p className="text-xs text-[#5A5A40] dark:text-[#9CB386] font-medium">{metadata.authors.join('; ')}</p>
                </div>
              )}
              <div className="col-span-2">
                <span className="text-[9px] font-bold text-[#8C897E] dark:text-[#9EA399] uppercase">Título</span>
                <p className="text-xs text-[#5A5A40] dark:text-[#9CB386] font-medium">{metadata.title}</p>
              </div>
              {metadata.year && (
                <div>
                  <span className="text-[9px] font-bold text-[#8C897E] dark:text-[#9EA399] uppercase">Ano</span>
                  <p className="text-xs text-[#5A5A40] dark:text-[#9CB386] font-medium">{metadata.year}</p>
                </div>
              )}
              {metadata.publication && (
                <div>
                  <span className="text-[9px] font-bold text-[#8C897E] dark:text-[#9EA399] uppercase">Publicação</span>
                  <p className="text-xs text-[#5A5A40] dark:text-[#9CB386] font-medium">{metadata.publication}</p>
                </div>
              )}
              <div>
                <span className="text-[9px] font-bold text-[#8C897E] dark:text-[#9EA399] uppercase">Tipo</span>
                <p className="text-xs text-[#5A5A40] dark:text-[#9CB386] font-medium capitalize">{metadata.type.replace('_', ' ')}</p>
              </div>
            </div>

            {/* Formatted ABNT Reference */}
            {formattedRef && (
              <div className={cn(
                'p-3 rounded-xl border font-mono text-[11px] leading-relaxed cursor-pointer transition-all hover:shadow-md',
                isDark ? 'bg-[#232821] border-[#2C3328] text-[#E8E6DF]' : 'bg-white border-[#E5E2D9] text-[#3D3D3D]'
              )}
              onClick={() => navigator.clipboard.writeText(formattedRef)}
              title="Clique para copiar"
              >
                <div className="text-[9px] font-bold text-[#8C897E] dark:text-[#9EA399] uppercase mb-1">
                  Referência ABNT (clique para copiar):
                </div>
                {formattedRef}
              </div>
            )}

            <button
              onClick={handleSelectReference}
              className="w-full py-2.5 rounded-xl text-xs font-bold transition-all bg-[#5A5A40] text-white hover:bg-[#7A763A] active:scale-[0.98] shadow-sm"
            >
              Usar esta referência ABNT
            </button>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className={cn(
            'flex items-start gap-2 px-4 py-3 rounded-xl text-xs',
            isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
          )}>
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Não foi possível extrair metadados.</p>
              <p className="text-[10px] opacity-75 mt-0.5">Verifique se o link está correto e tente novamente. Sites com proteção anti-scraping podem bloquear a extração.</p>
            </div>
          </div>
        )}

        {/* Memory Panel / How it works */}
        <CalculationMemoryPanel isVisible={showCalc} isDark={isDark}>
          <div className={cn(
            'p-2.5 rounded-lg border font-mono text-[11px] leading-relaxed',
            isDark ? 'bg-[#232821] border-[#2C3328] text-[#E8E6DF]' : 'bg-white border-[#E5E2D9] text-[#3D3D3D]'
          )}>
            <div className={cn('font-semibold mb-1', isDark ? 'text-[#9EA399]' : 'text-[#8C897E]')}>
              COMO FUNCIONA:
            </div>
            <div className={cn('font-bold', isDark ? 'text-[#9CB386]' : 'text-[#5A5A40]')}>
              <ElasticText className="font-bold" mode="auto">
                Auto-detecção de Referências ABNT
              </ElasticText>
            </div>
            <p className={cn('mt-1', isDark ? 'text-[#9EA399]' : 'text-[#8C897E]')}>
              O sistema extrai automaticamente autor, título, ano e publicação do link ou arquivo colado. 
              Utiliza tags meta Open Graph, Twitter Cards, e metadados de citação acadêmica para encontrar as informações.
              O resultado é formatado conforme ABNT NBR 6023:2025.
            </p>
          </div>
        </CalculationMemoryPanel>
      </div>
    </div>
  );
}