'use client';

import React, { useState, useRef, useCallback } from 'react';
import { FileText, Copy, Check } from 'lucide-react';

interface RedacaoGeradaProps {
  redacao: string;
  onUpdateSecao?: (chave: string, valor: string) => void;
  editable?: boolean;
}

interface Secao {
  titulo: string;
  chave: string;
  conteudo: string;
}

function parseRedacao(texto: string): Secao[] {
  const secoes: Secao[] = [];
  const padroes = [
    { titulo: 'INTRODUÇÃO', chave: 'introducao' },
    { titulo: 'DESENVOLVIMENTO 1', chave: 'desenvolvimento1' },
    { titulo: 'DESENVOLVIMENTO 2', chave: 'desenvolvimento2' },
    { titulo: 'DESENVOLVIMENTO 3', chave: 'desenvolvimento3' },
    { titulo: 'CONCLUSÃO', chave: 'conclusao' },
  ];

  const linhas = texto.split('\n');
  let secaoAtual: Secao | null = null;

  for (const linha of linhas) {
    const linhaUpper = linha.toUpperCase().trim();
    const padraoEncontrado = padroes.find(p => linhaUpper.includes(p.titulo));

    if (padraoEncontrado) {
      if (secaoAtual) secoes.push(secaoAtual);
      secaoAtual = { titulo: padraoEncontrado.titulo, chave: padraoEncontrado.chave, conteudo: '' };
    } else if (secaoAtual) {
      secaoAtual.conteudo += (secaoAtual.conteudo ? '\n' : '') + linha;
    }
  }

  if (secaoAtual) secoes.push(secaoAtual);

  // Se não encontrou seções formatadas, trata como texto único
  if (secoes.length === 0 && texto.trim()) {
    secoes.push({ titulo: 'REDAÇÃO', chave: 'redacao', conteudo: texto });
  }

  return secoes;
}

export default function RedacaoGerada({ redacao, onUpdateSecao, editable }: RedacaoGeradaProps) {
  const [copied, setCopied] = useState(false);
  const secoes = parseRedacao(redacao);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(redacao);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [redacao]);

  if (!redacao) {
    return (
      <div id="redacao_resultado" className="space-y-4">
        <h3 className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC] flex items-center gap-1.5">
          <FileText className="size-4" />
          Redação Gerada
        </h3>
        <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
          A redação será gerada após a validação da estrutura.
        </p>
      </div>
    );
  }

  return (
    <div id="redacao_resultado" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC] flex items-center gap-1.5">
          <FileText className="size-4" />
          Redação Gerada
        </h3>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#F3F1EC] dark:bg-[#2C3328] text-[#8C897E] dark:text-[#9EA399] hover:bg-[#E5E2D9] dark:hover:bg-[#3A4235] transition-colors"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      <div className="space-y-4">
        {secoes.map((secao) => (
          <SecaoEditor
            key={secao.chave}
            secao={secao}
            editable={editable}
            onUpdate={(conteudo) => onUpdateSecao?.(secao.chave, conteudo)}
          />
        ))}
      </div>
    </div>
  );
}

interface SecaoEditorProps {
  secao: Secao;
  editable?: boolean;
  onUpdate?: (conteudo: string) => void;
}

function SecaoEditor({ secao, editable, onUpdate }: SecaoEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    if (!editable || !onUpdate) return;
    const text = e.currentTarget.innerText || '';

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate(text);
    }, 300);
  }, [editable, onUpdate]);

  return (
    <div className="rounded-xl border border-[#E5E2D9] dark:border-[#3A4235] overflow-hidden">
      <div className="px-3 py-1.5 bg-[#F3F1EC] dark:bg-[#2C3328] border-b border-[#E5E2D9] dark:border-[#3A4235]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399]">
          {secao.titulo}
        </span>
      </div>
      <div
        key={secao.conteudo}
        contentEditable={editable}
        suppressContentEditableWarning
        onInput={handleInput}
        className={`p-3 text-sm text-[#242A20] dark:text-[#F3F1EC] leading-relaxed whitespace-pre-wrap ${
          editable
            ? 'focus:outline-none focus:bg-[#2E6F40]/5 dark:focus:bg-[#9CB386]/10 cursor-text'
            : ''
        }`}
      >
        {secao.conteudo}
      </div>
    </div>
  );
}
