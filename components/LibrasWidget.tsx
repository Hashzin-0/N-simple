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
    VLibrasWidget?: {
      initBtn?: HTMLElement;
    };
  }
}

const VLIBRAS_ROOT = 'https://vlibras.gov.br/app';
const VLIBRAS_PERSONALIZATION = 'https://vlibras.gov.br/config/default_logo.json';
const VLIBRAS_POLL_INTERVAL = 50;
const VLIBRAS_TIMEOUT = 5000;

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
      const existingWidget = document.querySelector('[vp-plugin]');
      if (existingWidget) {
        existingWidget.remove();
      }
      widgetRef.current = false;
      return;
    }

    if (widgetRef.current) return;

    function initWidget() {
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
    }

    // Initialize immediately if script already loaded
    initWidget();

    // Poll until script loads (loaded by layout.tsx <script> tag)
    if (!widgetRef.current) {
      let elapsed = 0;
      const timer = setInterval(() => {
        elapsed += VLIBRAS_POLL_INTERVAL;
        initWidget();
        if (widgetRef.current || elapsed >= VLIBRAS_TIMEOUT) {
          clearInterval(timer);
        }
      }, VLIBRAS_POLL_INTERVAL);

      return () => clearInterval(timer);
    }
  }, [settings.widgetEnabled, settings.widgetAvatar, settings.widgetPosition]);

  // Voice Tutor: abre o Widget sob comando do agente de voz.
  useEffect(() => {
    const handleVoiceOpen = (event: Event) => {
      const sign = String((event as CustomEvent).detail?.sign || '').trim();
      if (sign) {
        let target = document.getElementById('libras-voice-target');
        if (!target) {
          target = document.createElement('span');
          target.id = 'libras-voice-target';
          target.style.position = 'absolute';
          target.style.width = '1px';
          target.style.height = '1px';
          target.style.overflow = 'hidden';
          target.style.opacity = '0';
          target.style.pointerEvents = 'none';
          document.body.appendChild(target);
        }
        target.textContent = sign;
        const range = document.createRange();
        range.selectNodeContents(target);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }

      const button = window.VLibrasWidget?.initBtn as HTMLElement | undefined;
      if (button) button.click();
    };
    window.addEventListener('libras:open-vlibras', handleVoiceOpen);
    return () => window.removeEventListener('libras:open-vlibras', handleVoiceOpen);
  }, []);

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
