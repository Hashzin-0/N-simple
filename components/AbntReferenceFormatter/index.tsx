'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Copy, Check, Search } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { ABNTReference, ReferenceType } from '@/lib/abnt/types';
import { REFERENCE_TYPES } from '@/lib/abnt/constants';
import { formatReference, copyToClipboard } from '@/lib/abnt/utils';
import ReferenceTypeSelector from './ReferenceTypeSelector';
import ReferenceForm from './ReferenceForm';
import ReferenceList from './ReferenceList';
import { cn } from '@/lib/utils';

interface AbntReferenceFormatterProps {
  isConnected?: boolean;
  references: ABNTReference[];
  onSaveReference: (ref: ABNTReference) => void;
  onDeleteReference: (id: string) => void;
}

export default function AbntReferenceFormatter({
  isConnected,
  references,
  onSaveReference,
  onDeleteReference,
}: AbntReferenceFormatterProps) {
  const { isDark } = useTheme();
  const [selectedType, setSelectedType] = useState<ReferenceType | null>(null);
  const [editingRef, setEditingRef] = useState<ABNTReference | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSave = useCallback((ref: ABNTReference) => {
    onSaveReference(ref);
    setSelectedType(null);
    setEditingRef(null);
  }, [onSaveReference]);

  const handleDelete = useCallback((id: string) => {
    onDeleteReference(id);
  }, [onDeleteReference]);

  const handleEdit = useCallback((ref: ABNTReference) => {
    setSelectedType(ref.type);
    setEditingRef(ref);
  }, []);

  const handleCopyAll = useCallback(async () => {
    const formatted = references.map(r => formatReference(r)).join('\n\n');
    await copyToClipboard(formatted);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [references]);

  const filteredRefs = searchQuery
    ? references.filter(r =>
        formatReference(r).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : references;

  const inputBg = isDark ? 'bg-[#1A1E18]' : 'bg-[#FDFBF7]';
  const borderColor = isDark ? 'border-[#2C3328]' : 'border-[#E5E2D9]';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-[#5A5A40]/10 dark:bg-[#9CB386]/10 rounded-xl">
          <BookOpen className="h-5 w-5 text-[#5A5A40] dark:text-[#9CB386]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
            Formatador de Referências ABNT
          </h2>
          <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
            NBR 6023:2025 — Referências bibliográficas
          </p>
        </div>
      </div>

      {/* Reference Type Selector or Form */}
      <AnimatePresence mode="wait">
        {selectedType ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ReferenceForm
              type={selectedType}
              initialData={editingRef}
              onSave={handleSave}
              onCancel={() => { setSelectedType(null); setEditingRef(null); }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="selector"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ReferenceTypeSelector onSelect={setSelectedType} isConnected={isConnected} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reference List */}
      <ReferenceList
        references={filteredRefs}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
    </div>
  );
}
