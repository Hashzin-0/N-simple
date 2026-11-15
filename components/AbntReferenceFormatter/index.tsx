'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Search } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { ABNTReference, ReferenceType } from '@/lib/abnt/types';
import { formatReference, copyToClipboard } from '@/lib/abnt/utils';
import ReferenceTypeSelector from './ReferenceTypeSelector';
import ReferenceForm from './ReferenceForm';
import ReferenceList from './ReferenceList';

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
      <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">Norma aplicada: NBR 6023:2025</p>

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
