'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '@/components/ThemeProvider';
import { X, ExternalLink } from 'lucide-react';

interface LibrasVideoModalProps {
  videoId: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}

export default React.memo(function LibrasVideoModal({
  videoId,
  title,
  isOpen,
  onClose,
}: LibrasVideoModalProps) {
  const { isDark } = useTheme();

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl ${
              isDark ? 'bg-[#1C201A]' : 'bg-white'
            }`}
          >
            {/* Header */}
            <div
              className={`flex items-center justify-between px-4 py-3 border-b ${
                isDark
                  ? 'bg-[#242720] border-[#2C3328]'
                  : 'bg-[#FAF9F5] border-[#E5E2D9]'
              }`}
            >
              <h3
                className={`text-sm font-semibold truncate flex-1 mr-3 ${
                  isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'
                }`}
              >
                {title}
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={`https://www.youtube.com/watch?v=${videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isDark
                      ? 'bg-[#2C3328] text-[#9CB386] hover:bg-[#393E32]'
                      : 'bg-[#E5E2D9] text-[#2E6F40] hover:bg-[#D0CCC0]'
                  }`}
                >
                  <ExternalLink className="size-3" />
                  YouTube
                </a>
                <button
                  onClick={onClose}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDark
                      ? 'hover:bg-[#2C3328] text-[#9EA399]'
                      : 'hover:bg-[#E5E2D9] text-[#8C897E]'
                  }`}
                  aria-label="Fechar"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Video */}
            <div className="relative aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
