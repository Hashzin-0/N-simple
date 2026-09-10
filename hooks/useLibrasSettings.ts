'use client';

import { useSyncExternalStore, useCallback } from 'react';

export type LibrasAvatar = 'icaro' | 'hosana' | 'guga' | 'random';
export type WidgetPosition = 'R' | 'L';

export interface LibrasSettings {
  widgetEnabled: boolean;
  widgetPosition: WidgetPosition;
  widgetAvatar: LibrasAvatar;
  recognitionEnabled: boolean;
  recognitionSensitivity: number;
  customSigns: Record<string, number[][]>;
}

const STORAGE_KEY = 'agronomic_libras_settings_v1';
const SETTINGS_EVENT = 'agronomic_libras_update';

const DEFAULT_SETTINGS: LibrasSettings = {
  widgetEnabled: true,
  widgetPosition: 'R',
  widgetAvatar: 'random',
  recognitionEnabled: false,
  recognitionSensitivity: 0.7,
  customSigns: {},
};

let cachedRaw: string | null = null;
let cachedSettings: LibrasSettings = DEFAULT_SETTINGS;

function getSettingsSnapshot(): LibrasSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      if (cachedRaw !== null) {
        cachedRaw = null;
        cachedSettings = DEFAULT_SETTINGS;
      }
      return cachedSettings;
    }
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
    return cachedSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function subscribeToSettings(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener(SETTINGS_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(SETTINGS_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

function persistSettings(settings: LibrasSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    cachedRaw = JSON.stringify(settings);
    cachedSettings = settings;
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  } catch (e) {
    console.error('Failed to persist Libras settings:', e);
  }
}

export function useLibrasSettings() {
  const settings = useSyncExternalStore(subscribeToSettings, getSettingsSnapshot, getSettingsSnapshot);

  const updateSettings = useCallback((partial: Partial<LibrasSettings>) => {
    const current = getSettingsSnapshot();
    persistSettings({ ...current, ...partial });
  }, []);

  const toggleWidget = useCallback(() => {
    updateSettings({ widgetEnabled: !getSettingsSnapshot().widgetEnabled });
  }, [updateSettings]);

  const toggleRecognition = useCallback(() => {
    updateSettings({ recognitionEnabled: !getSettingsSnapshot().recognitionEnabled });
  }, [updateSettings]);

  const setWidgetPosition = useCallback((position: WidgetPosition) => {
    updateSettings({ widgetPosition: position });
  }, [updateSettings]);

  const setWidgetAvatar = useCallback((avatar: LibrasAvatar) => {
    updateSettings({ widgetAvatar: avatar });
  }, [updateSettings]);

  const addCustomSign = useCallback((label: string, landmarks: number[][]) => {
    const current = getSettingsSnapshot();
    updateSettings({
      customSigns: { ...current.customSigns, [label]: landmarks },
    });
  }, [updateSettings]);

  const removeCustomSign = useCallback((label: string) => {
    const current = getSettingsSnapshot();
    const { [label]: _, ...rest } = current.customSigns;
    updateSettings({ customSigns: rest });
  }, [updateSettings]);

  return {
    settings,
    updateSettings,
    toggleWidget,
    toggleRecognition,
    setWidgetPosition,
    setWidgetAvatar,
    addCustomSign,
    removeCustomSign,
  };
}
