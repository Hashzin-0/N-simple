'use client';

import { useEffect, useRef } from 'react';
import { useLibrasSettings, type LibrasAvatar, type WidgetPosition } from '@/hooks/useLibrasSettings';

declare global {
  interface Window {
    VLibras?: {
      Widget: new (
        rootPath: string,
        personalization: string,
        avatar: string,
        position: string
      ) => void;
    };
  }
}

const VLIBRAS_SCRIPT_URL = 'https://vlibras.gov.br/app/vlibras-plugin.js';
const VLIBRAS_ROOT = 'https://vlibras.gov.br/app';
const VLIBRAS_PERSONALIZATION = 'https://vlibras.gov.br/config/default_logo.json';

function getAvatarValue(avatar: LibrasAvatar): string {
  if (avatar === 'random') {
    const avatars = ['icaro', 'hosana', 'guga'];
    return avatars[Math.floor(Math.random() * avatars.length)];
  }
  return avatar;
}

export default function VLibrasWidget() {
  const { settings } = useLibrasSettings();
  const widgetRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settings.widgetEnabled) {
      // Remove widget if disabled
      const existingWidget = document.querySelector('[vp-plugin]');
      if (existingWidget) {
        existingWidget.remove();
      }
      widgetRef.current = false;
      return;
    }

    if (widgetRef.current) return;

    // Load VLibras script
    const script = document.createElement('script');
    script.src = VLIBRAS_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      // Initialize widget after script loads
      if (window.VLibras?.Widget && !widgetRef.current) {
        try {
          const avatar = getAvatarValue(settings.widgetAvatar);
          const position = settings.widgetPosition;

          new window.VLibras.Widget(
            VLIBRAS_ROOT,
            VLIBRAS_PERSONALIZATION,
            avatar,
            position
          );
          widgetRef.current = true;
        } catch (e) {
          console.error('Failed to initialize VLibras Widget:', e);
        }
      }
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [settings.widgetEnabled, settings.widgetAvatar, settings.widgetPosition]);

  // Reinitialize widget when settings change
  useEffect(() => {
    if (!settings.widgetEnabled || !widgetRef.current) return;

    // Remove existing widget
    const existingWidget = document.querySelector('[vp-plugin]');
    if (existingWidget) {
      existingWidget.remove();
      widgetRef.current = false;
    }

    // Reinitialize with new settings
    if (window.VLibras?.Widget) {
      try {
        const avatar = getAvatarValue(settings.widgetAvatar);
        const position = settings.widgetPosition;

        new window.VLibras.Widget(
          VLIBRAS_ROOT,
          VLIBRAS_PERSONALIZATION,
          avatar,
          position
        );
        widgetRef.current = true;
      } catch (e) {
        console.error('Failed to reinitialize VLibras Widget:', e);
      }
    }
  }, [settings.widgetAvatar, settings.widgetPosition, settings.widgetEnabled]);

  return <div ref={containerRef} className="libras-widget-container" />;
}
