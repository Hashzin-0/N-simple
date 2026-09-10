'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hand, Settings, X, ChevronDown, ChevronUp } from 'lucide-react';
import LibrasRecognition from './LibrasRecognition';
import { useLibrasSettings, type LibrasAvatar, type WidgetPosition } from '@/hooks/useLibrasSettings';

interface AccessibilityPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AccessibilityPanel({ isOpen, onClose }: AccessibilityPanelProps) {
  const {
    settings,
    toggleWidget,
    toggleRecognition,
    setWidgetPosition,
    setWidgetAvatar,
  } = useLibrasSettings();

  const [activeTab, setActiveTab] = useState<'recognition' | 'settings'>('recognition');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const handleSignRecognized = (sign: string, confidence: number) => {
    // Dispatch custom event for the main app to handle
    window.dispatchEvent(
      new CustomEvent('libras-sign', {
        detail: { sign, confidence },
      })
    );
  };

  const toggleSection = (section: string) => {
    setExpandedSection(prev => (prev === section ? null : section));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-gradient-to-b from-gray-900 to-gray-950 border-l border-white/10 shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl">
                  <Hand className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Acessibilidade Libras</h2>
                  <p className="text-xs text-white/50">Comunicação em Língua Brasileira de Sinais</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setActiveTab('recognition')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'recognition'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                Reconhecimento
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'settings'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                Configurações
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'recognition' ? (
                <LibrasRecognition onSignRecognized={handleSignRecognized} />
              ) : (
                <div className="space-y-4">
                  {/* VLibras Widget Settings */}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <button
                      onClick={() => toggleSection('widget')}
                      className="w-full flex items-center justify-between"
                    >
                      <span className="text-sm font-medium text-white">Widget VLibras</span>
                      {expandedSection === 'widget' ? (
                        <ChevronUp className="w-4 h-4 text-white/50" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-white/50" />
                      )}
                    </button>

                    <AnimatePresence>
                      {expandedSection === 'widget' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 space-y-4"
                        >
                          {/* Enable/Disable */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-white/70">Ativar widget</span>
                            <button
                              onClick={toggleWidget}
                              className={`relative w-12 h-6 rounded-full transition-colors ${
                                settings.widgetEnabled ? 'bg-blue-500' : 'bg-white/20'
                              }`}
                            >
                              <motion.div
                                className="absolute top-1 w-4 h-4 bg-white rounded-full"
                                animate={{ left: settings.widgetEnabled ? 28 : 4 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              />
                            </button>
                          </div>

                          {/* Position */}
                          <div>
                            <label className="text-sm text-white/70 block mb-2">Posição</label>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setWidgetPosition('L')}
                                className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                                  settings.widgetPosition === 'L'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : 'bg-white/5 text-white/50 border border-white/10'
                                }`}
                              >
                                Esquerda
                              </button>
                              <button
                                onClick={() => setWidgetPosition('R')}
                                className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                                  settings.widgetPosition === 'R'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : 'bg-white/5 text-white/50 border border-white/10'
                                }`}
                              >
                                Direita
                              </button>
                            </div>
                          </div>

                          {/* Avatar */}
                          <div>
                            <label className="text-sm text-white/70 block mb-2">Avatar</label>
                            <div className="grid grid-cols-2 gap-2">
                              {(['random', 'icaro', 'hosana', 'guga'] as LibrasAvatar[]).map(
                                (avatar) => (
                                  <button
                                    key={avatar}
                                    onClick={() => setWidgetAvatar(avatar)}
                                    className={`py-2 text-sm rounded-lg transition-colors capitalize ${
                                      settings.widgetAvatar === avatar
                                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                        : 'bg-white/5 text-white/50 border border-white/10'
                                    }`}
                                  >
                                    {avatar === 'random' ? 'Aleatório' : avatar}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Recognition Settings */}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <button
                      onClick={() => toggleSection('recognition')}
                      className="w-full flex items-center justify-between"
                    >
                      <span className="text-sm font-medium text-white">Reconhecimento de Sinais</span>
                      {expandedSection === 'recognition' ? (
                        <ChevronUp className="w-4 h-4 text-white/50" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-white/50" />
                      )}
                    </button>

                    <AnimatePresence>
                      {expandedSection === 'recognition' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 space-y-4"
                        >
                          {/* Enable/Disable */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-white/70">Ativar reconhecimento</span>
                            <button
                              onClick={toggleRecognition}
                              className={`relative w-12 h-6 rounded-full transition-colors ${
                                settings.recognitionEnabled ? 'bg-blue-500' : 'bg-white/20'
                              }`}
                            >
                              <motion.div
                                className="absolute top-1 w-4 h-4 bg-white rounded-full"
                                animate={{ left: settings.recognitionEnabled ? 28 : 4 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              />
                            </button>
                          </div>

                          {/* Sensitivity */}
                          <div>
                            <label className="text-sm text-white/70 block mb-2">
                              Sensibilidade: {Math.round(settings.recognitionSensitivity * 100)}%
                            </label>
                            <input
                              type="range"
                              min="0.3"
                              max="1"
                              step="0.1"
                              value={settings.recognitionSensitivity}
                              onChange={(e) =>
                                useLibrasSettings().updateSettings({
                                  recognitionSensitivity: parseFloat(e.target.value),
                                })
                              }
                              className="w-full"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
