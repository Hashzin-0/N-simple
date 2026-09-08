'use client';

import React, { useState, useMemo } from 'react';
import { Landmark, Info, CheckCircle2 } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import Input3D from '@/components/Input3D';
import { cn } from '@/lib/utils';

const ALIQUOT_TABLE = [
  { maxArea: 50,      rates: [1.00, 0.70, 0.40, 0.20, 0.03] },
  { maxArea: 200,     rates: [2.00, 1.40, 0.80, 0.40, 0.07] },
  { maxArea: 500,     rates: [3.30, 2.30, 1.30, 0.60, 0.10] },
  { maxArea: 1000,    rates: [4.70, 3.30, 1.90, 0.85, 0.15] },
  { maxArea: 5000,    rates: [8.60, 6.00, 3.40, 1.60, 0.30] },
  { maxArea: Infinity, rates: [20.00, 12.00, 6.40, 3.00, 0.45] },
];

const GU_LABELS = ['≤ 30%', '30–50%', '50–65%', '65–80%', '> 80%'];
const GU_UPPER = [30, 50, 65, 80, Infinity];

function getAliquotIndex(gu: number): number {
  if (gu <= 30) return 0;
  if (gu <= 50) return 1;
  if (gu <= 65) return 2;
  if (gu <= 80) return 3;
  return 4;
}

function getAreaRowIndex(areaHa: number): number {
  for (let i = 0; i < ALIQUOT_TABLE.length; i++) {
    if (areaHa <= ALIQUOT_TABLE[i].maxArea) return i;
  }
  return ALIQUOT_TABLE.length - 1;
}

function lookupAliquot(areaHa: number, gu: number): number {
  const row = getAreaRowIndex(areaHa);
  const col = getAliquotIndex(gu);
  return ALIQUOT_TABLE[row].rates[col];
}

export default function ITRCalculator({ isConnected }: { isConnected?: boolean }) {
  const { isDark } = useTheme();

  const [vtn, setVtn] = useState<number>(0);
  const [areaTotal, setAreaTotal] = useState<number>(0);
  const [areaTributavel, setAreaTributavel] = useState<number>(0);
  const [areaAproveitavel, setAreaAproveitavel] = useState<number>(0);
  const [areaUtilizada, setAreaUtilizada] = useState<number>(0);

  const result = useMemo(() => {
    if (areaTotal <= 0) return null;

    const vtnTributavel = vtn * (areaTributavel / areaTotal);
    const gu = areaAproveitavel > 0
      ? (areaUtilizada / areaAproveitavel) * 100
      : 0;
    const aliqPct = lookupAliquot(areaTotal, gu);
    const aliqDec = aliqPct / 100;
    const itr = vtnTributavel * aliqDec;

    return { vtnTributavel, gu: Math.min(gu, 100), aliqPct, itr };
  }, [vtn, areaTotal, areaTributavel, areaAproveitavel, areaUtilizada]);

  const areaRowIndex = result ? getAreaRowIndex(areaTotal) : -1;
  const guColIndex = result ? getAliquotIndex(result.gu) : -1;

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatPct = (v: number) => v.toFixed(2).replace('.', ',') + '%';
  const formatHa = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

  const inputBg = isDark ? 'bg-[#1A1E18]' : 'bg-[#FDFBF7]';
  const borderColor = isDark ? 'border-[#2C3328]' : 'border-[#E5E2D9]';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-[#5A5A40]/10 dark:bg-[#9CB386]/10 rounded-xl">
          <Landmark className="h-5 w-5 text-[#5A5A40] dark:text-[#9CB386]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
            Calculadora de ITR
          </h2>
          <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
            Imposto Territorial Rural — Lei 9.393/1996
          </p>
        </div>
      </div>

      {/* Input Form */}
      <div className={cn(
        `${isConnected ? 'rounded-b-2xl rounded-t-none' : 'rounded-2xl'} border p-5 space-y-4 transition-colors`,
        inputBg, borderColor
      )}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input3D
            id="itr_vtn"
            label="Valor da Terra Nua (VTN)"
            unit="R$"
            value={vtn}
            onChange={setVtn}
            min={0}
            step={1000}
          />
          <Input3D
            id="itr_area_total"
            label="Área Total"
            unit="ha"
            value={areaTotal}
            onChange={setAreaTotal}
            min={0}
            step={1}
          />
          <Input3D
            id="itr_area_tributavel"
            label="Área Tributável"
            unit="ha"
            value={areaTributavel}
            onChange={setAreaTributavel}
            min={0}
            step={1}
          />
          <Input3D
            id="itr_area_aproveitavel"
            label="Área Aproveitável"
            unit="ha"
            value={areaAproveitavel}
            onChange={setAreaAproveitavel}
            min={0}
            step={1}
          />
          <Input3D
            id="itr_area_utilizada"
            label="Área Efetivamente Utilizada"
            unit="ha"
            value={areaUtilizada}
            onChange={setAreaUtilizada}
            min={0}
            step={1}
          />
        </div>

        <div className="flex items-start gap-2 text-[10px] text-[#8C897E] dark:text-[#9EA399] bg-[#F9F8F6] dark:bg-[#232821] rounded-xl p-3">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            <strong>Área Tributável</strong> = Área Total − APP − Reserva Legal − RPPN − Floresta Nativa.
            <strong> Área Aproveitável</strong> = Área Total − Áreas Ambientais − Imprestdáveis.
            <strong> Área Utilizada</strong> = Lavouras + Pastagens Produtivas + Florestas Plantadas.
          </span>
        </div>
      </div>

      {/* Results */}
      {result && areaTotal > 0 && (
        <div className="space-y-4">
          {/* Hero Card */}
          <div className="bg-[#5A5A40] dark:bg-[#263122] rounded-2xl p-5 text-white border border-transparent dark:border-[#3D4C37] shadow-md">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-85">
              ITR Devido
            </span>
            <div className="mt-1.5 text-3xl font-bold font-serif">
              {formatCurrency(result.itr)}
            </div>
            <div className="mt-2 text-[10px] border-t border-white/20 pt-2 opacity-75 font-medium">
              VTNt × Alíquota = {formatCurrency(result.vtnTributavel)} × {formatPct(result.aliqPct)}
            </div>
          </div>

          {/* Sub-metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={cn('rounded-2xl border p-4 transition-colors', inputBg, borderColor)}>
              <span className="text-[10px] font-bold text-[#8C897E] dark:text-[#9EA399] uppercase block">
                VTNt
              </span>
              <div className="mt-1 text-xl font-bold text-[#5A5A40] dark:text-[#9CB386]">
                {formatCurrency(result.vtnTributavel)}
              </div>
              <div className="mt-1 text-[10px] text-[#8C897E] dark:text-[#9EA399] border-t border-[#F0EDE5] dark:border-[#2C3328] pt-1 font-medium">
                VTN × ({formatHa(areaTributavel)} ÷ {formatHa(areaTotal)})
              </div>
            </div>
            <div className={cn('rounded-2xl border p-4 transition-colors', inputBg, borderColor)}>
              <span className="text-[10px] font-bold text-[#8C897E] dark:text-[#9EA399] uppercase block">
                Grau de Utilização
              </span>
              <div className="mt-1 text-xl font-bold text-[#5A5A40] dark:text-[#9CB386]">
                {formatPct(result.gu)}
              </div>
              <div className="mt-1 text-[10px] text-[#8C897E] dark:text-[#9EA399] border-t border-[#F0EDE5] dark:border-[#2C3328] pt-1 font-medium">
                {formatHa(areaUtilizada)} ÷ {formatHa(areaAproveitavel)}
              </div>
            </div>
            <div className={cn('rounded-2xl border p-4 transition-colors', inputBg, borderColor)}>
              <span className="text-[10px] font-bold text-[#8C897E] dark:text-[#9EA399] uppercase block">
                Alíquota
              </span>
              <div className="mt-1 text-xl font-bold text-[#5A5A40] dark:text-[#9CB386]">
                {formatPct(result.aliqPct)}
              </div>
              <div className="mt-1 text-[10px] text-[#8C897E] dark:text-[#9EA399] border-t border-[#F0EDE5] dark:border-[#2C3328] pt-1 font-medium">
                Tabela Lei 9.393/1996
              </div>
            </div>
          </div>

          {/* Aliquot Table */}
          <div className={cn('rounded-2xl border p-5 transition-colors', inputBg, borderColor)}>
            <h3 className="text-xs font-bold text-[#8C897E] dark:text-[#9EA399] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5" /> Tabela de Alíquotas do ITR
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr>
                    <th className={`text-left p-2 font-bold border-b ${borderColor}`}>
                      Área Total (ha)
                    </th>
                    {GU_LABELS.map((label, i) => (
                      <th
                        key={i}
                        className={cn(
                          'text-center p-2 font-bold border-b',
                          borderColor,
                          i === guColIndex && areaRowIndex >= 0
                            ? 'bg-[#5A5A40]/10 dark:bg-[#9CB386]/10 text-[#5A5A40] dark:text-[#9CB386]'
                            : 'text-[#8C897E] dark:text-[#9EA399]'
                        )}
                      >
                        GU {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALIQUOT_TABLE.map((row, ri) => {
                    const areaLabel = ri === 0
                      ? 'Até 50'
                      : ri === ALIQUOT_TABLE.length - 1
                        ? 'Acima 5.000'
                        : `${ALIQUOT_TABLE[ri - 1].maxArea},1–${row.maxArea.toLocaleString('pt-BR')}`;
                    return (
                      <tr key={ri}>
                        <td className={cn(
                          'p-2 font-medium border-b',
                          borderColor,
                          ri === areaRowIndex
                            ? 'text-[#5A5A40] dark:text-[#9CB386] font-bold'
                            : 'text-[#8C897E] dark:text-[#9EA399]'
                        )}>
                          {areaLabel}
                        </td>
                        {row.rates.map((rate, ci) => {
                          const isActive = ri === areaRowIndex && ci === guColIndex;
                          return (
                            <td
                              key={ci}
                              className={cn(
                                'text-center p-2 border-b font-medium transition-colors',
                                borderColor,
                                isActive
                                  ? 'bg-[#5A5A40] dark:bg-[#2F372A] text-white font-bold rounded-lg shadow-sm'
                                  : ri === areaRowIndex || ci === guColIndex
                                    ? 'bg-[#5A5A40]/5 dark:bg-[#9CB386]/5'
                                    : 'text-[#8C897E] dark:text-[#9EA399]'
                              )}
                            >
                              {rate.toFixed(2).replace('.', ',')}%
                              {isActive && (
                                <CheckCircle2 className="inline-block h-3 w-3 ml-1 -mt-0.5" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
