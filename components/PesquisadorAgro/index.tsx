'use client';

import React, { useState } from 'react';
import PesquisadorFontesCard from './PesquisadorFontesCard';
import PortaisConfiaveisSection from './PortaisConfiaveisSection';
import PesquisadorAutomaticoSection from './PesquisadorAutomaticoSection';

interface PesquisadorAgroProps {
  isDark?: boolean;
}

export default function PesquisadorAgro({ isDark = false }: PesquisadorAgroProps) {
  const [currentTheme, setCurrentTheme] = useState<string>('');

  const handleSendToAutomatic = (newTheme: string) => {
    setCurrentTheme(newTheme);
    const autoSection = document.getElementById('pesquisador_automatico');
    if (autoSection) {
      autoSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full space-y-8 max-w-7xl mx-auto">
      {/* 1. ANTES DA SESSÃO: PESQUISADOR DE FONTES & ARTIGOS CIENTÍFICOS */}
      <PesquisadorFontesCard
        currentTheme={currentTheme}
        onThemeChange={setCurrentTheme}
        onSendToAutomaticResearcher={handleSendToAutomatic}
        isDark={isDark}
      />

      {/* 2. SESSÃO: PORTAIS & ACERVOS CONFIÁVEIS (Google Acadêmico, SciELO, Embrapa, etc.) */}
      <PortaisConfiaveisSection
        currentTheme={currentTheme}
        isDark={isDark}
      />

      {/* 3. APÓS OS SITES CONFIÁVEIS: PESQUISADOR AUTOMÁTICO (CRUZAMENTO DE 3+ FONTES, PRÁTICAS OBSOLETAS E ARTIGO ABNT) */}
      <PesquisadorAutomaticoSection
        currentTheme={currentTheme}
        onThemeChange={setCurrentTheme}
        isDark={isDark}
      />
    </div>
  );
}
