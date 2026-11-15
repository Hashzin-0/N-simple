'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, startTransition, useSyncExternalStore } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { motion, AnimatePresence } from 'motion/react';
import dynamic from 'next/dynamic';
import {
  Calculator,
  RotateCcw,
  CheckCircle2,
  Percent,
  Printer,
  Sprout,
  ArrowRightLeft,
  Hand,
} from 'lucide-react';
import AgentStatusOrb from '@/components/AgentStatusOrb';
import type { OrbState } from 'thinking-orbs';
import LoadingSkeleton3D from '@/components/LoadingSkeleton3D';
import Input3D from '@/components/Input3D';
import Select3D from '@/components/Select3D';
import { CssGooeyStack } from '@/components/godui/css-gooey-stack';
import { useGeminiLiveAgent } from '@/hooks/useGeminiLiveAgent';
import { useVoiceSettingsSync } from '@/hooks/useVoiceSettings';
import { voiceHub } from '@/lib/voiceHub';
import type { VoiceHUDState } from '@/components/VoiceAssistantHUD';
import { useTheme } from '@/components/ThemeProvider';
import { useAnimationLock } from '@/lib/useAnimationLock';
import { computeCalculations } from '@/lib/calculations';
import ExtracaoTotalCard from '@/components/metrics/ExtracaoTotalCard';
import NecessidadeLiquidaCard from '@/components/metrics/NecessidadeLiquidaCard';
import DoseRecomendadaCard from '@/components/metrics/DoseRecomendadaCard';
import FonteNitrogenadaCard from '@/components/metrics/FonteNitrogenadaCard';
import SecondaryCreditsCard from '@/components/metrics/SecondaryCreditsCard';
import ParcelamentoSection from '@/components/metrics/ParcelamentoSection';
import BalancoSection from '@/components/metrics/BalancoSection';
import DetailedMathPanel from '@/components/metrics/DetailedMathPanel';
import { ABNTReference } from '@/lib/abnt/types';
import { sortReferences } from '@/lib/abnt/utils';
import { type Preset } from '@/lib/types';
import BibliografiaAutoDetectCard from '@/components/metrics/BibliografiaAutoDetectCard';
i
…[1 chars truncated — re-run with head/grep/tail for full output]…
ação unitária."
                      filling={isFillingPreset}
                    />

                    {/* Checkbox inline: Eficiência já aplicada */}
                    <label className={`flex items-center gap-2.5 cursor-pointer group`}>
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={efficiencyAlreadyApplied}
                          onChange={(e) => setEfficiencyAlreadyAppliedValue(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className={`w-5 h-5 rounded-md border-2 transition-all duration-200 flex items-center justify-center ${
                          efficiencyAlreadyApplied
                            ? 'bg-[#2E6F40] border-[#2E6F40]'
                            : isDark ? 'border-[#5A5A40] bg-[#242720]' : 'border-[#D1CFC4] bg-white'
                        }`}>
                          {efficiencyAlreadyApplied && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-medium transition-colors ${
                        efficiencyAlreadyApplied
                          ? isDark ? 'text-[#9CB386]' : 'text-[#2E6F40]'
                          : isDark ? 'text-[#A6A395]' : 'text-[#8C897E]'
                      }`}>
                        Eficiência já aplicada
                      </span>
                    </label>

                    {!efficiencyAlreadyApplied && (
                      <Input3D
                        id="input_group_efficiency"
                        label="Eficiência de Aplicação (%)"
                        unit="%"
                        value={efficiency}
                        onChange={setEfficiencyValue}
                        onBlurCustom={setEfficiencyBlur}
                        step={1}
                        min={10}
                        max={100}
                        placeholder="Ex: 80"
                        isDark={isDark}
                        accentColor="#5A5A40"
                        hint="Eficiência padrão: 80% (fator 0.8). Perdas por volatilização/lixiviação."
                        filling={isFillingPreset}
                      />
                    )}
                  </>
                )}
              </div>

            </div>

        {/* PARCELAMENTO CONFIGURATION — standalone ScrollStack card */}
            <div id="parcelamento_config" className="bg-white dark:bg-[#1C201A] p-5 sm:p-6 rounded-2xl shadow-sm border border-[#E5E2D9] dark:border-[#2C3328] space-y-6 transition-colors">
              <div className="border-b border-[#F0EDE5] dark:border-[#2C3328] pb-4">
                <h3 className="text-sm font-bold text-[#5A5A40] dark:text-[#E8E6DF] uppercase tracking-wider flex items-center gap-2">
                  <Percent className="h-5 w-5 text-[#5A5A40] dark:text-[#9CB386]" /> Configuração do Parcelamento
                </h3>
                <p className="text-xs text-[#8C897E] dark:text-[#9EA399] mt-1">Configure as dosagens reais que deseja validar</p>
              </div>

              <div className="space-y-5">
                {/* Switch split base */}
                <Select3D
                  label="Base para cálculo do parcelamento:"
                  value={splitBase}
                  onChange={setSplitBaseValue}
                  isDark={isDark}
                  accentColor="#D4A373"
                  options={[
                    {
                      value: 'dose_perdas',
                      label: `Dose com Perdas (${calculations.recommendedDose} kg N/ha)`,
                      description: 'Inclui perdas por eficiência',
                    },
                    {
                      value: 'necessidade_liquida',
                      label: `Necessidade Líquida (${calculations.liquidNeed} kg N/ha)`,
                      description: 'Sem correção de perdas',
                    },
                  ]}
                />

                {/* 1st Application — Base/Semeadura (kg N/ha) — Cell Division Animation */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#3D3D3D] dark:text-[#E8E6DF]">
                      1ª Aplicação (Base / Semeadura)
                    </span>
                    <Select3D
                      value={baseDoseMode}
                      onChange={handleBaseDoseModeChange}
                      isDark={isDark}
                      accentColor="#D4A373"
                      options={[
                        { value: 'single', label: '1 valor' },
                        { value: 'range', label: '2 valores' },
                      ]}
                      className="!inline-flex !w-auto"
                    />
                  </div>

                  <CssGooeyStack collapsed={baseDoseMode === 'single'}>
                    <Input3D
                      label={baseDoseMode === 'range' ? 'Min (kg N/ha)' : 'Valor (kg N/ha)'}
                      labelMorph
                      unit="kg N/ha"
                      value={baseDose}
                      onChange={setBaseDoseValue}
                      step={1}
                      min={0}
                      max={100}
                      placeholder="Ex: 35"
                      isDark={isDark}
                      accentColor="#D4A373"
                      filling={isFillingPreset}
                    />
                    <Input3D
                      label="Max (kg N/ha)"
                      unit="kg N/ha"
                      value={baseDose2}
                      onChange={setBaseDose2Value}
                      step={1}
                      min={0}
                      max={100}
                      placeholder="0"
                      isDark={isDark}
                      accentColor="#D4A373"
                      filling={isFillingPreset}
                    />
                  </CssGooeyStack>

                  <p className="text-[10px] text-[#8C897E] dark:text-[#9EA399] mt-1 leading-relaxed">
                    * Faixa agronômica típica: 30 a 40 kg N/ha.
                  </p>
                </div>

                {/* 2nd Application — V4-V6 (% values) — Cell Division Animation */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#3D3D3D] dark:text-[#E8E6DF]">
                      2ª Aplicação (V4-V6) — Percentual
                    </span>
                    {baseDoseMode === 'single' ? (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isDark ? 'bg-[#2C3328] text-[#9CB386]' : 'bg-[#F0EDE5] text-[#5A5A40]'
                      }`}>
                        1 valor %
                      </span>
                    ) : (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isDark ? 'bg-[#2C3328] text-[#9CB386]' : 'bg-[#F0EDE5] text-[#5A5A40]'
                      }`}>
                        2 valores %
                      </span>
                    )}
                  </div>

                  <CssGooeyStack collapsed={baseDoseMode === 'single'}>
                    <Input3D
                      label={baseDoseMode === 'single' ? '% do total' : (baseDoseMode === 'range' ? 'Min %' : '% do total')}
                      labelMorph
                      unit="%"
                      value={v4v6Percent}
                      onChange={setV4v6PercentValue}
                      step={1}
                      min={0}
                      max={100}
                      placeholder="Ex: 50"
                      isDark={isDark}
                      accentColor="#5A5A40"
                      filling={isFillingPreset}
                    />
                    <Input3D
                      label="Max %"
                      labelMorph
                      unit="%"
                      value={v4v6Percent2}
                      onChange={setV4v6Percent2Value}
                      step={1}
                      min={0}
                      max={100}
                      placeholder="0"
                      isDark={isDark}
                      accentColor="#5A5A40"
                      filling={isFillingPreset}
                    />
                  </CssGooeyStack>

                  <p className="text-[10px] text-[#8C897E] dark:text-[#9EA399] leading-relaxed">
                    * Faixa agronômica padrão: 50% a 60% do total.
                  </p>
                </div>

                {/* 3rd Application — V8-V10 (% values, auto-calculated) — Cell Division Animation */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#3D3D3D] dark:text-[#E8E6DF]">
                      3ª Aplicação (V8-V10) — Percentual
                    </span>
                    {baseDoseMode === 'single' ? (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isDark ? 'bg-[#2C3328] text-[#D4A373]' : 'bg-[#F0EDE5] text-[#8D6E63]'
                      }`}>
                        Auto-calculado
                      </span>
                    ) : (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isDark ? 'bg-[#2C3328] text-[#D4A373]' : 'bg-[#F0EDE5] text-[#8D6E63]'
                      }`}>
                        2 valores %
                      </span>
                    )}
                  </div>

                  {baseDoseMode === 'single' ? (
                    <>
                      <div className={`p-4 rounded-xl border text-center ${
                        isDark ? 'bg-[#242720] border-[#393E32]' : 'bg-[#FAF9F5] border-[#E5E2D9]'
                      }`}>
                        <span className={`text-[10px] font-bold block mb-1 ${
                          isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
                        }`}>Auto-calculado para fechar o balanço</span>
                        <span className="text-lg font-bold text-[#8D6E63] dark:text-[#D4A373]">
                          {calculations.v8v10_1_auto}%
                        </span>
                        <span className={`text-xs ml-2 ${
                          isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
                        }`}>do total</span>
                      </div>
                    </>
                  ) : (
                    <CssGooeyStack collapsed={false}>
                      <Input3D
                        label={baseDoseMode === 'range' ? 'Min %' : '% do total'}
                        labelMorph
                        unit="%"
                        value={v8v10Percent}
                        onChange={setV8v10PercentValue}
                        step={1}
                        min={0}
                        max={100}
                        placeholder="Ex: 20"
                        isDark={isDark}
                        accentColor="#8D6E63"
                        derived={v8v10Percent === 0}
                        hint={v8v10Percent === 0 ? `Auto-calculado: ${calculations.v8v10_1_auto}%` : undefined}
                        filling={isFillingPreset}
                      />
                      <Input3D
                        label="Max %"
                        labelMorph
                        unit="%"
                        value={v8v10Percent2}
                        onChange={setV8v10Percent2Value}
                        step={1}
                        min={0}
                        max={100}
                        placeholder="0"
                        isDark={isDark}
                        accentColor="#8D6E63"
                        derived={v8v10Percent2 === 0 && v4v6Percent2 > 0}
                        hint={v8v10Percent2 === 0 && v4v6Percent2 > 0 ? `Auto-calculado: ${calculations.v8v10_2_auto}%` : undefined}
                        filling={isFillingPreset}
                      />
                    </CssGooeyStack>
                  )}

                  <p className="text-[10px] text-[#8C897E] dark:text-[#9EA399] leading-relaxed">
                    * Se deixar em 0%, o sistema calcula automaticamente para fechar o balanço. Faixa padrão: 20% a 30%.
                  </p>
                </div>
              </div>
            </div>

        {/* RESULTS SECTION — core metrics */}
          <section id="results_section" className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {!useDirectInput && (
                <ExtracaoTotalCard
                  totalExtraction={calculations.totalExtraction}
                  yieldGoal={yieldGoal}
                  nRequirementPerBag={nRequirementPerBag}
                />
              )}
              {!(useDirectInput && efficiencyAlreadyApplied) && (
                <NecessidadeLiquidaCard
                  liquidNeed={calculations.liquidNeed}
                  totalExtraction={useDirectInput ? 0 : calculations.totalExtraction}
                  mosNContribution={useDirectInput ? 0 : mosNContribution}
                  soyNContribution={useDirectInput ? 0 : soyNContribution}
                  useDirectInput={useDirectInput}
                />
              )}
              {!(useDirectInput && efficiencyAlreadyApplied) && (
                <div id="card_dose_total" className="col-span-2 sm:col-span-3">
                  <DoseRecomendadaCard
                    recommendedDose={calculations.recommendedDose}
                    liquidNeed={calculations.liquidNeed}
                    efficiency={useDirectInput && efficiencyAlreadyApplied ? 100 : efficiency}
                    efficiencyAlreadyApplied={useDirectInput && efficiencyAlreadyApplied}
                    onSaveClick={() => onSalvarCenario(`Cenário ${yieldGoal} sc/ha`)}
                  />
                </div>
              )}
              <div id="fonte_nitrogenada_section" className="col-span-2 sm:col-span-3">
                <FonteNitrogenadaCard
                  liquidNeed={calculations.liquidNeed}
                  selectedPreset={fontePreset}
                  customTeorN={fonteTeorN}
                  onChange={(patch) => {
                    if (patch.preset !== undefined) setFontePreset(patch.preset);
                    if (patch.customTeorN !== undefined) setFonteTeorN(patch.customTeorN);
                  }}
                />
              </div>
            </div>

            {!useDirectInput && (
              <SecondaryCreditsCard
                totalExtraction={calculations.totalExtraction}
                mosNContribution={mosNContribution}
                soyNContribution={soyNContribution}
              />
            )}
          </section>

        {/* PARCELAMENTO SECTION — split schedule */}
          <section id="parcelamento_results" className="space-y-6">
            <ParcelamentoSection
              calculations={calculations}
              splitBase={splitBase}
              v4v6Percent={v4v6Percent}
              v4v6Percent2={v4v6Percent2}
              v8v10Percent={v8v10Percent}
              v8v10Percent2={v8v10Percent2}
              baseDoseMode={baseDoseMode}
            />
          </section>

        {/* BALANCO SECTION — balance validation */}
          <section id="balanco_results" className="space-y-6">
            <BalancoSection calculations={calculations} />
          </section>

        {/* DETAILED FORMULA AND MATHEMATICAL EXPLANATIONS PANEL */}
        <DetailedMathPanel
          calculations={calculations}
          mosNContribution={mosNContribution}
          soyNContribution={soyNContribution}
          useDirectInput={useDirectInput}
        />
          </ScrollStack>
            </div>
          }
          productivityContent={productivityContent}
          sojaContent={soybeanContent}
          itrContent={itrContent}
          abntContent={abntContent}
          pesquisadorContent={pesquisadorContent}
          librasContent={librasContent}
          redacaoContent={redacaoContent}
          tutorContent={tutorContent}
          tratoristaContent={tratoristaContent}
          professorContent={professorContent}
        />
        </>
        )}

        {/* GEMINI LIVE VOICE ASSISTANT HUD WITH 3D ORB */}
        <VoiceAssistantHUD
          agentState={hudAgentState}
          onConnect={() => { setIsDisciplineHome(false); hudConnect(); }}
          onDisconnect={hudDisconnect}
          onToggleMute={hudToggleMute}
        />

        {/* VLIBRAS WIDGET */}
        <VLibrasWidget />

        {/* ACCESSIBILITY PANEL */}
        <AccessibilityPanel
          isOpen={isAccessibilityPanelOpen}
          onClose={() => setIsAccessibilityPanelOpen(false)}
        />

        {/* FOOTER */}
        <footer className="p-4 text-center border-t border-[#F0EDE5] dark:border-[#2C3328] text-[10px] text-[#8C897E] dark:text-[#9EA399] bg-[#F9F8F6] dark:bg-[#1C201A] rounded-2xl transition-colors">
          🌿 Desenvolvido para auxílio na tomada de decisão agronômica. Consulte sempre um Engenheiro Agrônomo.
        </footer>

      </div>

      {/* Floating Google sign-in island (only when logged out) */}
      <GoogleSignInIsland />
    </main>
    </>
  );
}
