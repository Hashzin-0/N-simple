'use client';

import React, { useState, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface TemaInputProps {
  onPesquisar: (tema: string) => void;
  isLoading?: boolean;
  temaInicial?: string;
}

export default function TemaInput({ onPesquisar, isLoading, temaInicial = '' }: TemaInputProps) {
  const [tema, setTema] = useState(temaInicial);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (tema.trim() && !isLoading) {
      onPesquisar(tema.trim());
    }
  }, [tema, isLoading, onPesquisar]);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm font-medium text-[#242A20] dark:text-[#F3F1EC]">
        Qual é o tema da sua redação?
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          placeholder="Ex.: Os desafios da inclusão digital no Brasil"
          className="flex-1 px-4 py-3 rounded-xl bg-[#F3F1EC] dark:bg-[#2C3328] border border-[#E5E2D9] dark:border-[#3A4235] text-[#242A20] dark:text-[#F3F1EC] placeholder-[#8C897E] dark:placeholder-[#9EA399] focus:outline-none focus:ring-2 focus:ring-[#2E6F40] dark:focus:ring-[#9CB386] transition-colors"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!tema.trim() || isLoading}
          className="px-5 py-3 rounded-xl bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] font-medium flex items-center gap-2 hover:bg-[#245A33] dark:hover:bg-[#8AB87A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          <span className="hidden sm:inline">Pesquisar</span>
        </button>
      </div>
    </form>
  );
}
