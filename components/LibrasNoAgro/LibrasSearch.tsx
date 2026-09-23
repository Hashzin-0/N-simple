'use client';

import React, { useState, useCallback } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import LibrasVideoCard from './LibrasVideoCard';
import { extractSignsFromText, stripSentenceEnding } from '@/lib/libras-search-utils';
import type { LibrasVideoResult, LibrasSignGroup } from '@/lib/libras-types';

interface LibrasSearchProps {
  initialQuery?: string;
  maxResults?: number;
  onResults?: (results: LibrasVideoResult[]) => void;
}

export default React.memo(function LibrasSearch({
  initialQuery = '',
  maxResults = 3,
  onResults,
}: LibrasSearchProps) {
  const { isDark } = useTheme();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<LibrasVideoResult[]>([]);
  const [signGroups, setSignGroups] = useState<LibrasSignGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const phrase = stripSentenceEnding(trimmed) || trimmed;
      const signs = extractSignsFromText(trimmed);
      const params = new URLSearchParams({ q: phrase, limit: String(maxResults) });
      // Multi-word input → one video group per sign + the full phrase
      if (signs.length > 1) params.set('signs', signs.join(','));

      const res = await fetch(`/api/libras/search?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao buscar vídeos');
        setResults([]);
        setSignGroups([]);
      } else {
        const phraseResults: LibrasVideoResult[] = data.phraseResults || data.results || [];
        const groups: LibrasSignGroup[] = data.signGroups || [];
        setResults(phraseResults);
        setSignGroups(groups);
        onResults?.(phraseResults);
      }
    } catch {
      setError('Erro de conexão ao buscar vídeos');
      setResults([]);
      setSignGroups([]);
    } finally {
      setLoading(false);
    }
  }, [query, maxResults, onResults]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch]
  );

  const totalVideos =
    results.length + signGroups.reduce((n, g) => n + g.results.length, 0);

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div
        className={`flex items-center gap-2 p-1 rounded-2xl border transition-all ${
          isDark
            ? 'bg-[#242720] border-[#393E32] focus-within:border-[#9CB386]'
            : 'bg-[#FAF9F5] border-[#E5E2D9] focus-within:border-[#5A5A40]'
        }`}
      >
        <div className="flex-1 flex items-center gap-2 px-3">
          <Search
            className={`size-4 flex-shrink-0 ${
              isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
            }`}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma palavra... (ex: gado, milho, trator)"
            className={`flex-1 bg-transparent outline-none text-sm py-2 ${
              isDark
                ? 'text-[#E8E6DF] placeholder:text-[#5A5A40]'
                : 'text-[#3D3D3D] placeholder:text-[#8C897E]'
            }`}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            loading || !query.trim()
              ? 'opacity-50 cursor-not-allowed'
              : isDark
              ? 'bg-[#9CB386] text-[#121511] hover:bg-[#86efac]'
              : 'bg-[#2E6F40] text-white hover:bg-[#245a33]'
          }`}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            'Buscar'
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
            isDark
              ? 'bg-red-900/20 text-red-300 border border-red-800/30'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <AlertCircle className="size-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {searched && !loading && !error && (
        <div className="space-y-4">
          <p
            className={`text-xs font-medium ${
              isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
            }`}
          >
            {totalVideos > 0
              ? `${totalVideos} vídeo(s) encontrado(s)`
              : 'Nenhum vídeo encontrado para este termo'}
          </p>

          {results.length > 0 && (
            <div>
              {signGroups.length > 0 && (
                <p
                  className={`text-xs font-semibold mb-2 ${
                    isDark ? 'text-[#9CB386]' : 'text-[#2E6F40]'
                  }`}
                >
                  Frase completa
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {results.map((video) => (
                  <LibrasVideoCard key={video.videoId} video={video} />
                ))}
              </div>
            </div>
          )}

          {signGroups.map((group) => (
            <div key={group.sign}>
              <p
                className={`text-xs font-semibold mb-2 ${
                  isDark ? 'text-[#9CB386]' : 'text-[#2E6F40]'
                }`}
              >
                Sinal: {group.sign}
              </p>
              {group.results.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.results.map((video) => (
                    <LibrasVideoCard key={video.videoId} video={video} />
                  ))}
                </div>
              ) : (
                <p
                  className={`text-sm ${
                    isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
                  }`}
                >
                  Nenhum vídeo encontrado para este sinal
                </p>
              )}
            </div>
          ))}

          {totalVideos === 0 && (
            <p
              className={`text-sm ${
                isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
              }`}
            >
              Nenhum vídeo encontrado para este termo
            </p>
          )}
        </div>
      )}

      {/* Empty state before search */}
      {!searched && !loading && (
        <div
          className={`text-center py-8 ${
            isDark ? 'text-[#5A5A40]' : 'text-[#8C897E]'
          }`}
        >
          <Search className="size-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">
            Busque sinais em Libras relacionados ao agronegócio
          </p>
        </div>
      )}
    </div>
  );
});
