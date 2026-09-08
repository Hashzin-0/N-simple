'use client';

import React, { useMemo } from 'react';
import { Layers, TrendingUp, Minus, TrendingDown } from 'lucide-react';
import { MultiButton, type MultiButtonItem } from './multi-button';

import type { Preset } from '@/lib/types';

const PRESET_ICONS = [TrendingUp, Minus, TrendingDown];

export interface PresetMultiButtonProps<T extends { id: string; name: string } = Preset> {
  presets: T[];
  activePreset: string;
  onPresetClick: (preset: T) => void;
  isDark: boolean;
  id?: string;
}

function PresetMultiButtonComponent<T extends { id: string; name: string } = Preset>({
  presets,
  activePreset,
  onPresetClick,
  isDark,
  id,
}: PresetMultiButtonProps<T>) {
  const items: MultiButtonItem[] = useMemo(
    () =>
      presets.map((p, i) => {
        const Icon = PRESET_ICONS[i] ?? Layers;
        return {
          id: p.id,
          icon: ({ className }: { className?: string }) => (
            <Icon className={className} />
          ),
          label: p.name.split(' ')[0],
          ariaLabel: p.name,
          onClick: () => onPresetClick(p),
        };
      }),
    [presets, onPresetClick],
  );

  return (
    <div
      id={id}
      className="flex items-center gap-2 pb-4 border-b border-[#F0EDE5] dark:border-[#2C3328]"
    >
      <span className="flex-shrink-0 whitespace-nowrap text-[10px] font-bold text-[#8C897E] dark:text-[#9EA399] uppercase tracking-wider flex items-center gap-1.5">
        <Layers className="h-3 w-3" /> Cenários:
      </span>
      <div className="flex-1 min-w-0">
        <MultiButton
          gooey
          variant="secondary"
          size="sm"
          items={items}
          selectedId={activePreset}
          highlightColor={isDark ? '#9CB386' : '#2E6F40'}
        />
      </div>
    </div>
  );
}

const PresetMultiButton = React.memo(PresetMultiButtonComponent) as <
  T extends { id: string; name: string } = Preset
>(
  props: PresetMultiButtonProps<T>
) => React.ReactElement | null;

export default PresetMultiButton;

