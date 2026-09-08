'use client';

import { useState } from 'react';
import { Plug, ArrowUp } from 'lucide-react';
import { GooeyStack } from '@/components/godui/gooey-stack';

export function ConnectPrompt() {
  const [open, setOpen] = useState(false);

  return (
    <GooeyStack collapsed={!open}>
      {/* Children are transparent content — GooeyStack draws the card surface */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="flex items-center gap-3 text-neutral-200">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
          <span className="text-sm font-medium">GitHub</span>
          <span className="text-xs text-neutral-500">Connected</span>
        </div>
      </div>
      <div className="relative h-36 px-5 py-4">
        <textarea
          placeholder="Tap the plug to connect a source and watch it merge in…"
          className="w-full h-full resize-none bg-transparent text-sm text-neutral-200
                     placeholder-neutral-500 outline-none"
        />
        <div className="absolute right-4 bottom-4 flex gap-2">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Connect a source"
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200
                       hover:bg-white/[0.06] transition-colors"
          >
            <Plug size={18} />
          </button>
          <button
            aria-label="Send"
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200
                       hover:bg-white/[0.06] transition-colors"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
    </GooeyStack>
  );
}
