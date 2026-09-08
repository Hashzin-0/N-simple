'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Check, Trash2, Edit3, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { ABNTReference } from '@/lib/abnt/types';
import { REFERENCE_TYPES } from '@/lib/abnt/constants';
import { formatReference, copyToClipboard } from '@/lib/abnt/utils';
import { cn } from '@/lib/utils';

interface ReferenceListProps {
  references: ABNTReference[];
  onDelete: (id: string) => void;
  onEdit: (ref: ABNTReference) => void;
}

export default function ReferenceList({ references, onDelete, onEdit }: ReferenceListProps) {
  const { isDark } = useTheme();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleCopy = useCallback(async (ref: ABNTReference) => {
    await copyToClipboard(formatReference(ref));
    setCopiedId(ref.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (references.length === 0) return null;

  const inputBg = isDark ? 'bg-[#1A1E18]' : 'bg-[#FDFBF7]';
  const borderColor = isDark ? 'border-[#2C3328]' : 'border-[#E5E2D9]';

  return (
    <div className={cn('rounded-2xl border p-5 space-y-4 transition-colors', inputBg, borderColor)}>
      <h3 className="text-sm font-bold text-[#5A5A40] dark:text-[#E8E6DF] uppercase tracking-wider">
        Referências ({references.length})
      </h3>
      <div className="space-y-3">
        <AnimatePresence>
          {references.map(ref => (
            <motion.div
              key={ref.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                'rounded-xl border p-3 transition-colors',
                isDark ? 'bg-[#242720] border-[#393E32]' : 'bg-white border-[#E5E2D9]'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <button
                      onClick={() => toggleExpanded(ref.id)}
                      className="flex items-center gap-1.5"
                    >
                      <span className={cn(
                        'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                        isDark ? 'bg-[#9CB386]/20 text-[#9CB386]' : 'bg-[#5A5A40]/10 text-[#5A5A40]'
                      )}>
                        {REFERENCE_TYPES.find(t => t.id === ref.type)?.label || ref.type}
                      </span>
                      {expandedIds.has(ref.id) ? (
                        <ChevronUp className="h-3 w-3 text-[#8C897E]" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-[#8C897E]" />
                      )}
                    </button>
                  </div>
                  <p className={cn(
                    'text-xs leading-relaxed',
                    expandedIds.has(ref.id) ? '' : 'line-clamp-2',
                    'text-[#5A5A40] dark:text-[#E8E6DF]'
                  )}>
                    {formatReference(ref)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleCopy(ref)}
                    className="p-1.5 rounded-lg hover:bg-[#5A5A40]/10 dark:hover:bg-[#9CB386]/10 transition-colors"
                    title="Copiar"
                  >
                    {copiedId === ref.id ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-[#8C897E] dark:text-[#9EA399]" />
                    )}
                  </button>
                  <button
                    onClick={() => onEdit(ref)}
                    className="p-1.5 rounded-lg hover:bg-[#5A5A40]/10 dark:hover:bg-[#9CB386]/10 transition-colors"
                    title="Editar"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-[#8C897E] dark:text-[#9EA399]" />
                  </button>
                  <button
                    onClick={() => onDelete(ref.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
