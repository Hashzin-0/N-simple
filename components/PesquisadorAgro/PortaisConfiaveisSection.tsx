'use client';

import React from 'react';
import {
  Globe,
  ExternalLink,
  Search,
  Building2,
  Layers,
} from 'lucide-react';
import { RELIABLE_PORTALS } from './portalsData';
import { ReliablePortal } from './types';
import { CardSwap } from '@/components/godui/card-swap';

interface PortaisConfiaveisSectionProps {
  currentTheme: string;
  isDark: boolean;
}

export default function PortaisConfiaveisSection({
  currentTheme,
  isDark,
}: PortaisConfiaveisSectionProps) {
  const getSearchUrl = (portal: ReliablePortal) => {
    const query = currentTheme || 'agropecuaria sustentavel';
    return portal.searchUrlTemplate.replace('{query}', encodeURIComponent(query));
  };

  return (
    <section id="pesquisador_portais" className="space-y-6">
      {/* SECTION HEADER */}
      <div className="bg-white dark:bg-[#1C201A] p-6 rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] shadow-sm space-y-3">
        <div className="flex items-center gap-3 border-b border-[#F0EDE5] dark:border-[#2C3328] pb-4">
          <div className="p-3 rounded-2xl bg-[#D4A373]/20 text-[#8D6E63] dark:text-[#D4A373] border border-[#D4A373]/30 shrink-0">
            <Globe className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#5A5A40] dark:text-[#E8E7DF]">
                Portais & Acervos Confiáveis em Agropecuária
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#8C897E] dark:text-[#A6A395] mt-0.5">
              Repositórios oficiais, indexadores globais e bibliotecas eletrônicas reconhecidas. Arraste o card para a esquerda ou direita para alternar entre os portais.
            </p>
          </div>
        </div>

        {currentTheme && (
          <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-[#FAF8F5] dark:bg-[#121511] border border-[#F0EDE5] dark:border-[#242A20] text-xs">
            <span className="text-[#5A5A40] dark:text-[#C5D9B0] flex items-center gap-1.5 font-medium">
              <Search className="h-4 w-4 text-[#2E6F40] dark:text-[#9CB386]" />
              Tema de busca ativo: <strong className="text-[#242A20] dark:text-[#F3F1EC]">&ldquo;{currentTheme}&rdquo;</strong>
            </span>
            <span className="text-[11px] text-[#8C897E] dark:text-[#9EA399] hidden sm:inline">
              Os botões em cada card abrem a pesquisa direcionada no acervo
            </span>
          </div>
        )}
      </div>

      {/* PORTAIS - card swap com navegação por gesto */}
      <div className="w-full max-w-xl mx-auto py-4 px-2 sm:px-4">
        <CardSwap stacked={false} className="h-[340px]">
          {RELIABLE_PORTALS.map((portal) => {
            const directSearchUrl = getSearchUrl(portal);

            return (
              <div
                key={portal.id}
                className="bg-white dark:bg-[#1A1E17] p-6 sm:p-7 rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] shadow flex flex-col justify-between h-full hover:border-[#2E6F40]/50 dark:hover:border-[#9CB386]/50 transition-all"
                style={{ backgroundColor: isDark ? '#1A1E17' : '#FFFFFF' }}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-[#F0EDE5] dark:border-[#2C3328] pb-3">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/20 dark:text-[#9CB386] inline-block">
                        {portal.badge}
                      </span>
                      <h3 className="text-lg sm:text-xl font-serif font-bold text-[#242A20] dark:text-[#F3F1EC] leading-tight">
                        {portal.name}
                      </h3>
                      <p className="text-xs text-[#8C897E] dark:text-[#9EA399] font-medium flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-[#5A5A40] dark:text-[#A6A395]" />
                        {portal.organization}
                      </p>
                    </div>
                    <Layers className="h-4 w-4 text-[#D4A373] dark:text-[#D4A373] shrink-0 mt-1" />
                  </div>

                  <p className="text-xs sm:text-sm text-[#5A5A40] dark:text-[#C5D9B0] leading-relaxed line-clamp-3">
                    {portal.description}
                  </p>

                  <div className="text-[11px] bg-[#FAF8F5] dark:bg-[#121511] p-3 rounded-2xl border border-[#F0EDE5] dark:border-[#242A20] text-[#5A5A40] dark:text-[#A6A395]">
                    <strong className="text-[#2E6F40] dark:text-[#9CB386]">Foco principal:</strong> {portal.focusArea}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F0EDE5] dark:border-[#2C3328] flex flex-col sm:flex-row items-center gap-2">
                  <a
                    href={directSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:flex-1 py-2.5 px-3.5 bg-[#2E6F40] hover:bg-[#255833] text-white rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5 text-center"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span className="truncate">
                      Pesquisar &ldquo;{currentTheme || 'Agro'}&rdquo;
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>

                  <a
                    href={portal.baseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto py-2.5 px-4 bg-[#FAF8F5] dark:bg-[#242A20] hover:bg-[#F0EDE5] dark:hover:bg-[#2C3328] text-[#5A5A40] dark:text-[#E8E6DF] rounded-xl text-xs font-medium border border-[#E5E2D9] dark:border-[#2C3328] transition-colors flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <span>Abrir Portal</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </CardSwap>
      </div>
    </section>
  );
}
