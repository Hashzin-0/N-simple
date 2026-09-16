'use client';

import React from 'react';
import Image from 'next/image';
import { useTheme } from '@/components/ThemeProvider';
import { ExternalLink } from 'lucide-react';
import type { LibrasVideoResult } from '@/lib/libras-types';

interface LibrasVideoCardProps {
  video: LibrasVideoResult;
  compact?: boolean;
}

export default React.memo(function LibrasVideoCard({ video, compact }: LibrasVideoCardProps) {
  const { isDark } = useTheme();

  return (
    <div
      className={`group relative rounded-2xl border transition-all duration-200 overflow-hidden ${
        isDark
          ? 'bg-[#1C201A] border-[#2C3328] hover:border-[#393E32]'
          : 'bg-white border-[#E5E2D9] hover:border-[#D0CCC0]'
      } ${compact ? 'flex gap-3' : ''}`}
    >
      {/* Thumbnail */}
      <div className={`relative overflow-hidden ${compact ? 'w-28 h-20 flex-shrink-0' : 'aspect-video'}`}>
        <Image
          src={video.thumbnail}
          alt={video.title}
          fill
          unoptimized
          style={{ objectFit: 'cover' }}
          className="transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Assistir ${video.title}`}
        >
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <ExternalLink className="size-5 text-[#2E6F40]" />
          </div>
        </a>
      </div>

      {/* Info */}
      <div className={`p-3 ${compact ? 'flex-1 min-w-0' : ''}`}>
        <h4
          className={`font-semibold text-sm leading-tight line-clamp-2 ${
            isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'
          }`}
        >
          {video.title}
        </h4>
        <p
          className={`text-xs mt-1 truncate ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}
        >
          {video.channel}
        </p>
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 text-xs font-medium mt-2 transition-colors ${
            isDark
              ? 'text-[#9CB386] hover:text-[#86efac]'
              : 'text-[#2E6F40] hover:text-[#1a5c2e]'
          }`}
        >
          Assistir <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
});
