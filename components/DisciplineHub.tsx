'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BarChart3,
  CloudSun,
  BriefcaseBusiness,
  Calculator,
  FileText,
  GraduationCap,
  Hand,
  Languages,
  Leaf,
  Monitor,
  Search,
  ShieldCheck,
  Sprout,
  Tractor,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { TabId } from '@/components/GooeyTabPanel';

interface DisciplineFeature {
  tab?: TabId;
  href?: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

interface Discipline {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  features: DisciplineFeature[];
}

const DISCIPLINES: Discipline[] = [
  {
    id: 'praticas-pedagogicas-orientadas',
    title: 'Práticas Pedagógicas Orientadas',
    description: 'Aplicação prática dos conhecimentos agronômicos por meio de cálculos, estimativas e atividades orientadas.',
    icon: GraduationCap,
    accent: '#668A63',
    features: [
      { tab: 'nitrogen', title: 'Adubação nitrogenada', description: 'Calcule a necessidade de nitrogênio e planeje o parcelamento da adubação.', icon: Sprout },
      { tab: 'productivity', title: 'Estimativa de produtividade', description: 'Estime a produtividade das culturas, incluindo soja, em uma ferramenta única.', icon: Calculator },
    ],
  },
  {
    id: 'inteligencia-dados-agropecuarios',
    title: 'Inteligência de Dados Agropecuários',
    description: 'Indicadores oficiais de produção, pecuária e condições meteorológicas para apoiar decisões no campo.',
    icon: BarChart3,
    accent: '#4E8790',
    features: [
      { tab: 'ibge', title: 'Dados agropecuários do IBGE', description: 'Consulte produção agrícola (PAM), efetivos pecuários (PPM) e séries municipais.', icon: BarChart3 },
      { tab: 'weather', title: 'Meteorologia agrícola', description: 'Consulte previsão, chuva, temperatura, vento e evapotranspiração.', icon: CloudSun },
      { href: 'https://www.cepea.org.br/br/indicadores/', title: 'Indicadores CEPEA', description: 'Acesse os indicadores oficiais de preços e mercados agropecuários. Consulta externa; integração via API depende de contratação e credenciais.', icon: TrendingUp },
      { href: 'https://consultaprecosdemercado.conab.gov.br/', title: 'Preços agropecuários CONAB', description: 'Consulte preços de mercado publicados pela CONAB no portal oficial.', icon: BarChart3 },
    ],
  },
  {
    id: 'administracao-rural',
    title: 'Administração Rural',
    description: 'Planejamento, gestão da propriedade, custos e tomada de decisão no campo.',
    icon: BriefcaseBusiness,
    accent: '#C19262',
    features: [
      { tab: 'itr', title: 'Gestão tributária rural', description: 'Calcule o ITR e organize os dados da propriedade.', icon: Calculator },
    ],
  },
  {
    id: 'agroecologia',
    title: 'Agroecologia e Produção Sustentável',
    description: 'Manejo de culturas, conservação dos recursos e sistemas produtivos sustentáveis.',
    icon: Leaf,
    accent: '#5D8A58',
    features: [
      { tab: 'tratorista', title: 'Mecanização agrícola', description: 'Estude operações, tração, máquinas e segurança no trabalho rural.', icon: Tractor },
    ],
  },
  {
    id: 'gestao-social-ambiental',
    title: 'Gestão Social e Ambiental',
    description: 'Responsabilidade socioambiental, inclusão, comunicação e gestão responsável.',
    icon: Users,
    accent: '#4E8790',
    features: [
      { tab: 'libras', title: 'Libras no Agro', description: 'Aprenda sinais e pratique comunicação acessível.', icon: Hand },
    ],
  },
  {
    id: 'informatica',
    title: 'Introdução à Informática',
    description: 'Competências digitais, documentos e ferramentas de produtividade.',
    icon: Monitor,
    accent: '#6685B5',
    features: [
      { tab: 'professor', title: 'Documentos e apresentações', description: 'Trabalhe com arquivos e materiais de estudo.', icon: FileText },
    ],
  },
  {
    id: 'legislacao',
    title: 'Legislação Agrária e Ambiental',
    description: 'Referências legais, regularidade da propriedade e interpretação de normas.',
    icon: ShieldCheck,
    accent: '#9A8051',
    features: [
      { tab: 'pesquisador', title: 'Pesquisa de legislação e fontes', description: 'Localize documentos e referências para consulta.', icon: Search },
    ],
  },
  {
    id: 'metodologia',
    title: 'Metodologia do Trabalho Científico',
    description: 'Pesquisa, seleção de fontes, organização de evidências e produção acadêmica.',
    icon: Search,
    accent: '#8A6E9E',
    features: [
      { tab: 'abnt', title: 'Normas e referências ABNT', description: 'Formate referências e materiais acadêmicos.', icon: BookOpen },
    ],
  },
  {
    id: 'portugues',
    title: 'Português Instrumental | Normas Técnicas e Redação',
    description: 'Comunicação escrita, produção textual e normalização de trabalhos.',
    icon: Languages,
    accent: '#B47B65',
    features: [
      { tab: 'redacao', title: 'Redação e repertório', description: 'Planeje textos, desenvolva argumentos e revise sua redação.', icon: FileText },
    ],
  },
  {
    id: 'etica',
    title: 'Ética Profissional',
    description: 'Conduta, responsabilidade técnica e tomada de decisão profissional.',
    icon: ShieldCheck,
    accent: '#8C8C65',
    features: [
      { tab: 'tutor', title: 'Estudo dirigido', description: 'Revise ética, legislação e conteúdos profissionais.', icon: GraduationCap },
    ],
  },
];
interface DisciplineHubProps {
  onOpenTab: (tab: TabId) => void;
}

export default function DisciplineHub({ onOpenTab }: DisciplineHubProps) {
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string | null>(null);
  const selectedDiscipline = DISCIPLINES.find((item) => item.id === selectedDisciplineId);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-8" aria-labelledby="discipline-hub-title">
      <AnimatePresence mode="wait">
        {selectedDiscipline ? (
          <motion.div
            key={selectedDiscipline.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <button
              type="button"
              onClick={() => setSelectedDisciplineId(null)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#D9D6CB] bg-white px-4 py-2 text-sm font-semibold text-[#4C5945] transition hover:bg-[#F2F3ED] dark:border-[#394236] dark:bg-[#20271F] dark:text-[#D9E4D2] dark:hover:bg-[#293329]"
            >
              <ArrowLeft className="size-4" /> Voltar para Geral
            </button>

            <div className="rounded-3xl border border-[#E2E0D6] bg-white p-6 shadow-sm dark:border-[#343D32] dark:bg-[#1C241D] sm:p-8">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl p-3" style={{ backgroundColor: `${selectedDiscipline.accent}20`, color: selectedDiscipline.accent }}>
                  <selectedDiscipline.icon className="size-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7D8677]">Área de formação</p>
                  <h2 className="mt-1 text-2xl font-bold text-[#344333] dark:text-[#E5EADF] sm:text-3xl">{selectedDiscipline.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[#737B70] dark:text-[#B0B8AA]">{selectedDiscipline.description}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {selectedDiscipline.features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.button
                    key={`${feature.tab}-${feature.title}`}
                    type="button"
                    onClick={() => { if (feature.tab) onOpenTab(feature.tab); else if (feature.href) window.open(feature.href, '_blank', 'noopener,noreferrer'); }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="group flex min-h-44 flex-col items-start rounded-2xl border border-[#E2E0D6] bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-[#9BAE8E] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D8A58] dark:border-[#343D32] dark:bg-[#1C241D] dark:hover:border-[#71876A]"
                  >
                    <span className="flex size-11 items-center justify-center rounded-xl bg-[#EDF1E9] text-[#55764F] dark:bg-[#2B382B] dark:text-[#A9C49D]">
                      <Icon className="size-5" />
                    </span>
                    <span className="mt-4 text-base font-bold text-[#394638] dark:text-[#E5EADF]">{feature.title}</span>
                    <span className="mt-1 flex-1 text-sm leading-5 text-[#7B8176] dark:text-[#B0B8AA]">{feature.description}</span>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#55764F] dark:text-[#A9C49D]">{feature.href ? 'Abrir fonte oficial' : 'Abrir ferramenta'} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" /></span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="discipline-home"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-7"
          >
            <div className="rounded-3xl border border-[#E2E0D6] bg-white p-6 shadow-sm dark:border-[#343D32] dark:bg-[#1C241D] sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#71836B]">Geral · N-simple</p>
                  <h2 id="discipline-hub-title" className="mt-2 text-3xl font-bold tracking-tight text-[#344333] dark:text-[#E5EADF] sm:text-4xl">Seu ambiente de aprendizagem e gestão do agro</h2>
                  <p className="mt-3 text-sm leading-6 text-[#737B70] dark:text-[#B0B8AA]">Acesse as ferramentas organizadas pelas áreas de formação. Cada área reúne calculadoras, pesquisa, cursos e recursos de aprendizagem relacionados.</p>
                </div>
                <div className="hidden size-20 shrink-0 items-center justify-center rounded-3xl bg-[#EDF1E9] text-[#55764F] dark:bg-[#2B382B] dark:text-[#A9C49D] sm:flex">
                  <Sprout className="size-10" />
                </div>
              </div>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-[#394638] dark:text-[#E5EADF]">Áreas de formação</h3>
                <p className="mt-1 text-sm text-[#7B8176] dark:text-[#B0B8AA]">Selecione uma área para visualizar suas ferramentas.</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#E9EEE4] px-3 py-1 text-xs font-bold text-[#55764F] dark:bg-[#2B382B] dark:text-[#A9C49D]">{DISCIPLINES.length} áreas</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {DISCIPLINES.map((discipline, index) => {
                const Icon = discipline.icon;
                return (
                  <motion.button
                    key={discipline.id}
                    type="button"
                    onClick={() => setSelectedDisciplineId(discipline.id)}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.035 }}
                    className="group flex min-h-56 flex-col items-start rounded-2xl border border-[#E2E0D6] bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D8A58] dark:border-[#343D32] dark:bg-[#1C241D]"
                    style={{ borderTopColor: discipline.accent, borderTopWidth: 3 }}
                  >
                    <span className="flex size-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${discipline.accent}20`, color: discipline.accent }}>
                      <Icon className="size-6" />
                    </span>
                    <span className="mt-4 text-lg font-bold leading-snug text-[#394638] dark:text-[#E5EADF]">{discipline.title}</span>
                    <span className="mt-2 flex-1 text-sm leading-5 text-[#7B8176] dark:text-[#B0B8AA]">{discipline.description}</span>
                    <span className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#55764F] dark:text-[#A9C49D]">{discipline.features.length} ferramentas relacionadas <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" /></span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
