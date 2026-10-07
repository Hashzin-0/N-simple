'use client';

import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Upload, Brain, CheckCircle2, AlertTriangle, Sparkles, Image as ImageIcon, Wand2, SearchCheck, MessageCircle, Accessibility, ChevronRight } from 'lucide-react';

type Analysis = {
  documentType: 'word' | 'powerpoint';
  title: string;
  executiveSummary: string;
  purpose: string;
  audience: string;
  strengths: string[];
  priorityIssues: Array<{ severity: 'alta'|'media'|'baixa'; unit: string; issue: string; why: string; recommendation: string }>;
  contentMap: Array<{ unit: string; mainIdea: string; role: string }>;
  visualDiagnosis: Array<{ unit: string; status: string; reason: string }>;
  questionsToStart: string[];
  suggestedActions: string[];
  confidence: number;
};

type Session = {
  fileName: string;
  structure: {
    slides: number; paragraphs: number; tables: number; images: Array<{path:string;mimeType:string;size:number}>;
    animations: number; transitions: number; notes: number; title: string;
  };
  analysis: Analysis;
  documentContext: string;
};

const starterPrompts = [
  { icon: ImageIcon, label: 'Imagens', text: 'Quais imagens devo usar e em quais partes? Quero sugestões acadêmicas, específicas e com fonte/credito.' },
  { icon: AlertTriangle, label: 'Erros', text: 'Quais são os erros mais importantes que precisamos corrigir, separando erros factuais, estruturais e de linguagem?' },
  { icon: Wand2, label: 'Animações', text: 'Quais animações e transições fazem sentido neste PowerPoint? Diga o objeto, a ordem e por que a animação ajuda.' },
  { icon: Sparkles, label: 'Resumir', text: 'Como posso reduzir o texto sem perder o conteúdo científico e transformar partes em elementos visuais?' },
  { icon: SearchCheck, label: 'Rigor', text: 'Faça uma revisão acadêmica: tese/pergunta, objetivos, método, evidências, limitações, conclusão e referências.' },
  { icon: Accessibility, label: 'Acessibilidade', text: 'Faça uma auditoria de acessibilidade do arquivo e diga o que corrigir no Word ou PowerPoint.' },
];

export default function ProfessorDocumentos() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Array<{role:'user'|'assistant';text:string}>>([]);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'idle'|'uploading'|'understanding'|'ready'|'asking'|'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const metrics = useMemo(() => {
    if (!session) return [];
    return session.analysis.documentType === 'powerpoint'
      ? [
          ['Slides', session.structure.slides],
          ['Imagens', session.structure.images.length],
          ['Animações', session.structure.animations],
          ['Transições', session.structure.transitions],
          ['Notas', session.structure.notes],
        ]
      : [
          ['Parágrafos', session.structure.paragraphs],
          ['Tabelas', session.structure.tables],
          ['Imagens', session.structure.images.length],
        ];
  }, [session]);

  async function upload(file: File) {
    setError(null);
    setMessages([]);
    setSession(null);
    setLoading(true);
    setPhase('uploading');
    try {
      if (!/\.(docx|pptx)$/i.test(file.name)) throw new Error('Use Word (.docx) ou PowerPoint (.pptx).');
      if (file.size > 20 * 1024 * 1024) throw new Error('O limite desta análise é 20 MB.');
      setPhase('understanding');
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/professor-documentos', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não foi possível analisar o arquivo.');
      setSession(data);
      setPhase('ready');
    } catch (e) {
      setPhase('error');
      setError(e instanceof Error ? e.message : 'Falha ao analisar o documento.');
    } finally {
      setLoading(false);
    }
  }

  async function ask(text = question) {
    const value = text.trim();
    if (!value || !session || loading) return;
    setQuestion('');
    setMessages(prev => [...prev, { role: 'user', text: value }]);
    setLoading(true);
    setPhase('asking');
    try {
      const res = await fetch('/api/professor-documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: value,
          analysis: session.analysis,
          documentContext: session.documentContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'O Professor não conseguiu responder.');
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer }]);
      setPhase('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao responder.');
      setPhase('error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
      <section id="professor_documentos_inicio" className="scroll-mt-24 overflow-hidden rounded-[2rem] border border-[#DCD8CC] dark:border-[#30382D] bg-[#F8F6EF] dark:bg-[#1B2019]">
        <div className="grid lg:grid-cols-[1.15fr_.85fr]">
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[#2E6F40]/10 text-[#2E6F40] dark:text-[#9CB386]">
                <Brain className="size-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6E705F] dark:text-[#A7AF9E]">Professor de Documentos</p>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#30352C] dark:text-[#F0EEE6]">Entender primeiro. Orientar depois.</h2>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm sm:text-base leading-7 text-[#67685E] dark:text-[#C2C6BB]">
              Carregue um Word ou PowerPoint. O Professor lê a estrutura, conteúdo, elementos visuais, notas e sinais de animação antes de começar a conversa.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => inputRef.current?.click()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-[#2E6F40] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50">
                <Upload className="size-4" /> {session ? 'Trocar arquivo' : 'Carregar Word ou PowerPoint'}
              </button>
              <input ref={inputRef} type="file" accept=".docx,.pptx" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f) upload(f); e.currentTarget.value=''; }} />
              {session && <div className="inline-flex items-center gap-2 rounded-xl border border-[#D8D4C8] dark:border-[#343D30] bg-white/70 dark:bg-white/5 px-4 py-3 text-sm font-semibold"><CheckCircle2 className="size-4 text-[#2E6F40]" /> {session.fileName}</div>}
            </div>
          </div>
          <div className="border-t lg:border-t-0 lg:border-l border-[#DCD8CC] dark:border-[#30382D] p-6 sm:p-8 bg-white/60 dark:bg-black/10">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#77786C] dark:text-[#A7AF9E]">Método de revisão</div>
            <div className="mt-4 space-y-3">
              {['Compreensão integral', 'Diagnóstico por evidência', 'Recomendações acionáveis', 'Perguntas adaptativas'].map((x,i) => (
                <div key={x} className="flex items-start gap-3">
                  <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#2E6F40]/10 text-[10px] font-bold text-[#2E6F40]">{i+1}</span>
                  <span className="text-sm text-[#505249] dark:text-[#D0D2CA]">{x}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {loading && (
          <motion.section initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="rounded-2xl border border-[#DCD8CC] dark:border-[#30382D] bg-white dark:bg-[#1C201A] p-5">
            <div className="flex items-center gap-3">
              <div className="size-3 rounded-full bg-[#2E6F40] animate-pulse" />
              <div>
                <p className="font-semibold text-[#3D3D3D] dark:text-[#ECEAE2]">{phase === 'uploading' ? 'Carregando arquivo…' : phase === 'asking' ? 'Consultando o documento…' : 'Entendendo o arquivo…'}</p>
                <p className="text-xs text-[#8C897E] dark:text-[#A6A395] mt-1">A conversa só fica disponível depois da leitura inicial.</p>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {error && (
        <section className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-800 dark:text-red-200">{error}</section>
      )}

      {session && (
        <>
          <section id="professor_documentos_diagnostico" className="scroll-mt-24 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#77786C] dark:text-[#A7AF9E]">Diagnóstico inicial</p>
                <h3 className="text-xl sm:text-2xl font-bold text-[#30352C] dark:text-[#F0EEE6]">{session.analysis.title}</h3>
              </div>
              <div className="flex gap-2 flex-wrap">{metrics.map(([label,value]) => <span key={label} className="rounded-xl border border-[#DDD9CE] dark:border-[#343D30] px-3 py-2 text-xs font-semibold text-[#67685E] dark:text-[#BFC5B8]">{label}: {value}</span>)}</div>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-2xl border border-[#DDD9CE] dark:border-[#343D30] bg-white dark:bg-[#1C201A] p-5">
                <h4 className="font-bold text-[#30352C] dark:text-[#F0EEE6]">Leitura acadêmica</h4>
                <p className="mt-2 text-sm leading-7 text-[#5F6258] dark:text-[#C8CBC2]">{session.analysis.executiveSummary}</p>
                <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="font-semibold">Objetivo percebido:</span> {session.analysis.purpose}</div>
                  <div><span className="font-semibold">Público:</span> {session.analysis.audience}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-[#DDD9CE] dark:border-[#343D30] bg-white dark:bg-[#1C201A] p-5">
                <h4 className="font-bold">Pontos fortes</h4>
                <ul className="mt-3 space-y-2 text-sm">{session.analysis.strengths.slice(0,5).map(x=><li key={x} className="flex gap-2"><CheckCircle2 className="size-4 mt-0.5 text-[#2E6F40] shrink-0"/>{x}</li>)}</ul>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[#DDD9CE] dark:border-[#343D30] bg-white dark:bg-[#1C201A] p-5">
                <h4 className="font-bold flex items-center gap-2"><AlertTriangle className="size-4 text-[#B56B45]"/> Prioridades</h4>
                <div className="mt-3 space-y-3">{session.analysis.priorityIssues.slice(0,8).map((x,i)=><div key={i} className="rounded-xl bg-[#F7F5EE] dark:bg-[#222820] p-3"><div className="flex justify-between gap-3 text-xs font-semibold"><span>{x.unit}</span><span className={x.severity==='alta'?'text-red-600':x.severity==='media'?'text-[#A66A38]':'text-[#66705E]'}>{x.severity}</span></div><p className="mt-1 text-sm font-semibold">{x.issue}</p><p className="mt-1 text-xs leading-5 opacity-80">{x.why}</p><p className="mt-1 text-xs leading-5"><b>Ação:</b> {x.recommendation}</p></div>)}</div>
              </div>
              <div className="rounded-2xl border border-[#DDD9CE] dark:border-[#343D30] bg-white dark:bg-[#1C201A] p-5">
                <h4 className="font-bold flex items-center gap-2"><MessageCircle className="size-4 text-[#2E6F40]"/> Como posso ajudar?</h4>
                <div className="mt-3 grid sm:grid-cols-2 gap-2">{[...starterPrompts.map(x=>x.text), ...session.analysis.questionsToStart.slice(0,2)].map((q,i)=><button key={i} onClick={()=>ask(q)} className="group text-left rounded-xl border border-[#DDD9CE] dark:border-[#343D30] p-3 hover:border-[#2E6F40]/40 hover:bg-[#2E6F40]/5 transition"><span className="text-xs leading-5 text-[#55584F] dark:text-[#C6CAC0]">{q}</span><ChevronRight className="size-3.5 inline ml-1 opacity-50 group-hover:translate-x-0.5 transition"/></button>)}</div>
              </div>
            </div>
          </section>

          <section id="professor_documentos_conversa" className="scroll-mt-24 rounded-2xl border border-[#DDD9CE] dark:border-[#343D30] bg-white dark:bg-[#1C201A] overflow-hidden">
            <div className="p-5 border-b border-[#E8E4D9] dark:border-[#30382D]">
              <h3 className="font-bold flex items-center gap-2"><MessageCircle className="size-5 text-[#2E6F40]"/> Professor disponível</h3>
              <p className="text-xs text-[#8C897E] dark:text-[#A6A395] mt-1">Pergunte sobre conteúdo, imagens, referências, resumo, narrativa, layout, animações, acessibilidade ou preparação da apresentação.</p>
            </div>
            <div className="max-h-[32rem] overflow-y-auto p-5 space-y-4">
              {messages.length === 0 ? <div className="text-sm text-[#77786C] dark:text-[#A7AF9E]">Faça uma pergunta. O Professor já carregou o contexto do arquivo.</div> : messages.map((m,i)=><div key={i} className={m.role==='user'?'flex justify-end':'flex justify-start'}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${m.role==='user'?'bg-[#2E6F40] text-white':'bg-[#F4F2EA] dark:bg-[#252B22] text-[#3F423A] dark:text-[#E1E3DD]'}`}>{m.text}</div></div>)}
            </div>
            <form onSubmit={e=>{e.preventDefault();ask();}} className="p-4 border-t border-[#E8E4D9] dark:border-[#30382D] flex gap-2">
              <input value={question} onChange={e=>setQuestion(e.target.value)} disabled={loading} placeholder="Ex.: Como introduzir a parte sobre X sem criar mais um bloco de texto?" className="min-w-0 flex-1 rounded-xl border border-[#D9D5C9] dark:border-[#394134] bg-transparent px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#2E6F40]/30" />
              <button disabled={loading || !question.trim()} className="rounded-xl bg-[#2E6F40] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Enviar</button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
