'use client';

import React from 'react';
import { FolderOpen, Trash2, BookmarkCheck } from 'lucide-react';
import { useCalculationRecords, SQLikeCalculationDB } from '@/lib/storage';
import { useTheme } from '@/components/ThemeProvider';

interface Props {
  onLoad: (id: string) => { success: boolean; name?: string; error?: string };
}

export default React.memo(function SavedScenariosCard({ onLoad }: Props) {
  const records = useCalculationRecords();
  const { isDark } = useTheme();

  if (records.length === 0) return null;

  return (
    <div
      id="saved_scenarios_section"
      className={`rounded-2xl border p-4 transition-colors ${
        isDark ? 'bg-[#1C201A] border-[#2C3328]' : 'bg-[#F9F8F6] border-[#E5E2D9]'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <BookmarkCheck className={`h-4 w-4 ${isDark ? 'text-[#9CB386]' : 'text-[#5A5A40]'}`} />
        <span className={`text-[10px] font-bold uppercase tracking-widest ${
          isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
        }`}>
          Cenários salvos ({records.length})
        </span>
      </div>

      <ul className="space-y-2">
        {records.slice(0, 8).map((r) => (
          <li
            key={r.id}
            className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 border text-xs ${
              isDark ? 'bg-[#232821] border-[#2C3328] text-[#E8E6DF]' : 'bg-white border-[#E5E2D9] text-[#3D3D3D]'
            }`}
          >
            <div className="min-w-0">
              <div className="font-bold truncate">{r.name}</div>
              <div className={`text-[10px] ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
                {r.yield_goal} sc/ha · dose {r.recommended_dose.toFixed(1)} kg N/ha
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onLoad(r.id)}
                className={`flex items-center gap-1 rounded-lg px-2 py-1.5 font-bold transition-colors ${
                  isDark
                    ? 'bg-[#2C3328] hover:bg-[#3A4234] text-[#9CB386]'
                    : 'bg-[#E5E2D9] hover:bg-[#D9D6CC] text-[#5A5A40]'
                }`}
                title="Carregar cenário"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Carregar
              </button>
              <button
                type="button"
                onClick={() => SQLikeCalculationDB.delete(r.id)}
                className={`flex items-center justify-center rounded-lg p-1.5 transition-colors ${
                  isDark
                    ? 'hover:bg-[#3A2C2C] text-[#C58A8A]'
                    : 'hover:bg-[#F3E5E5] text-[#B06060]'
                }`}
                title="Excluir cenário"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
});
