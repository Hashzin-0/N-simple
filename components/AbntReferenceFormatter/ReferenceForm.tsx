'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { ABNTReference, Author, ReferenceType } from '@/lib/abnt/types';
import { REFERENCE_TYPES } from '@/lib/abnt/constants';
import { parseAuthorString, formatAuthorsABNT } from '@/lib/abnt/parsers/author';
import { normalizeMonth } from '@/lib/abnt/parsers/date';
import { formatReference, generateId } from '@/lib/abnt/utils';
import { cn, neonFocusClasses } from '@/lib/utils';

interface ReferenceFormProps {
  type: ReferenceType;
  initialData: ABNTReference | null;
  onSave: (ref: ABNTReference) => void;
  onCancel: () => void;
}

function createEmptyRef(type: ReferenceType): ABNTReference {
  return {
    id: generateId(),
    type,
    authors: [],
    title: '',
    year: '',
  };
}

export default function ReferenceForm({ type, initialData, onSave, onCancel }: ReferenceFormProps) {
  const { isDark } = useTheme();
  const [ref, setRef] = useState<ABNTReference>(initialData || createEmptyRef(type));
  const [authorInput, setAuthorInput] = useState('');

  const config = REFERENCE_TYPES.find(t => t.id === type);

  const preview = useMemo(() => formatReference(ref), [ref]);

  const updateField = <K extends keyof ABNTReference>(key: K, value: ABNTReference[K]) => {
    setRef(prev => ({ ...prev, [key]: value }));
  };

  const addAuthor = () => {
    if (!authorInput.trim()) return;
    const parsed = parseAuthorString(authorInput);
    if (parsed.surname) {
      setRef(prev => ({ ...prev, authors: [...prev.authors, parsed] }));
      setAuthorInput('');
    }
  };

  const removeAuthor = (index: number) => {
    setRef(prev => ({
      ...prev,
      authors: prev.authors.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(ref);
  };

  const inputBg = isDark ? 'bg-[#1A1E18]' : 'bg-[#FDFBF7]';
  const borderColor = isDark ? 'border-[#2C3328]' : 'border-[#E5E2D9]';

const showsAuthors = config?.requiredFields.includes('authors') || config?.optionalFields.includes('authors');
  const showsTitle = config?.requiredFields.includes('title') || config?.optionalFields.includes('title');
  const showsLocation = config?.requiredFields.includes('location') || config?.optionalFields.includes('location');
  const showsPublisher = config?.requiredFields.includes('publisher') || config?.optionalFields.includes('publisher');
  const showsYear = config?.requiredFields.includes('year') || config?.optionalFields.includes('year');
  const showsJournalTitle = config?.requiredFields.includes('journalTitle') || config?.optionalFields.includes('journalTitle');
  const showsVolume = config?.requiredFields.includes('volume') || config?.optionalFields.includes('volume');
  const showsNumber = config?.requiredFields.includes('number') || config?.optionalFields.includes('number');
  const showsPages = config?.requiredFields.includes('pages') || config?.optionalFields.includes('pages');
  const showsUrl = config?.requiredFields.includes('url') || config?.optionalFields.includes('url');
  const showsAccessDate = config?.requiredFields.includes('accessDate') || config?.optionalFields.includes('accessDate');
  const showsDegree = config?.requiredFields.includes('degree') || config?.optionalFields.includes('degree');
  const showsInstitution = config?.requiredFields.includes('institution') || config?.optionalFields.includes('institution');
  const showsOrganization = config?.requiredFields.includes('organization') || config?.optionalFields.includes('organization');
  const showsEventName = config?.requiredFields.includes('eventName') || config?.optionalFields.includes('eventName');
  const showsEventLocation = config?.requiredFields.includes('eventLocation') || config?.optionalFields.includes('eventLocation');
  const showsEventYear = config?.requiredFields.includes('eventYear') || config?.optionalFields.includes('eventYear');
  const showsBookTitle = config?.requiredFields.includes('bookTitle') || config?.optionalFields.includes('bookTitle');
  const showsStandardNumber = config?.requiredFields.includes('standardNumber') || config?.optionalFields.includes('standardNumber');
  const showsStandardOrganization = config?.requiredFields.includes('standardOrganization') || config?.optionalFields.includes('standardOrganization');
  const showsLegislationType = config?.requiredFields.includes('legislationType') || config?.optionalFields.includes('legislationType');
  const showsLegislationNumber = config?.requiredFields.includes('legislationNumber') || config?.optionalFields.includes('legislationNumber');
  const showsLegislationSource = config?.requiredFields.includes('legislationSource') || config?.optionalFields.includes('legislationSource');
  const showsLegislationDate = config?.requiredFields.includes('legislationDate') || config?.optionalFields.includes('legislationDate');
  const showsPatentNumber = config?.requiredFields.includes('patentNumber') || config?.optionalFields.includes('patentNumber');
  const showsInventor = config?.requiredFields.includes('inventor') || config?.optionalFields.includes('inventor');
  const showsFilingDate = config?.requiredFields.includes('filingDate') || config?.optionalFields.includes('filingDate');
  const showsGrantDate = config?.requiredFields.includes('grantDate') || config?.optionalFields.includes('grantDate');
  const showsAiVersion = config?.requiredFields.includes('aiVersion') || config?.optionalFields.includes('aiVersion');
  const showsAiLocation = config?.requiredFields.includes('aiLocation') || config?.optionalFields.includes('aiLocation');
  const showsAudiovisualType = config?.requiredFields.includes('audiovisualType') || config?.optionalFields.includes('audiovisualType');

  return (
    <form onSubmit={handleSubmit} className={cn(
      'rounded-2xl border p-5 space-y-4 transition-colors',
      inputBg, borderColor
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-xl hover:bg-[#5A5A40]/10 dark:hover:bg-[#9CB386]/10 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-[#5A5A40] dark:text-[#9CB386]" />
        </button>
        <div>
          <h3 className="text-sm font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
            {config?.label || type}
          </h3>
          <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
            {config?.description}
          </p>
        </div>
      </div>

      {/* Authors */}
      {showsAuthors && (
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
            Autores *
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAuthor(); } }}
              placeholder="Sobrenome, Nome"
              className={cn(
                'flex-1 px-3 py-2 text-sm rounded-xl border transition-colors',
                inputBg, borderColor,
                neonFocusClasses,
                'text-[#5A5A40] dark:text-[#E8E6DF] placeholder:text-[#8C897E] dark:placeholder:text-[#9EA399]'
              )}
            />
            <button
              type="button"
              onClick={addAuthor}
              className="px-3 py-2 rounded-xl bg-[#5A5A40] dark:bg-[#9CB386] text-white text-sm font-bold"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {ref.authors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {ref.authors.map((a, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-xs bg-[#5A5A40]/10 dark:bg-[#9CB386]/10 text-[#5A5A40] dark:text-[#9CB386] px-2 py-1 rounded-lg"
                >
                  {formatAuthorsABNT([a])}
                  <button type="button" onClick={() => removeAuthor(i)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-[10px] text-[#8C897E] dark:text-[#9EA399]">
            Formato: SOBRENOME, Nome. Ex: Silva, João Pedro
          </p>
        </div>
      )}

      {/* Title */}
      {showsTitle && (
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
            Título *
          </label>
          <input
            type="text"
            value={ref.title}
            onChange={(e) => updateField('title', e.target.value)}
            className={cn(
              'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
              inputBg, borderColor,
  neonFocusClasses,

              'text-[#5A5A40] dark:text-[#E8E6DF]'
            )}
          />
        </div>
      )}

      {/* Subtitle */}
      {config?.optionalFields.includes('subtitle') && (
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
            Subtítulo
          </label>
          <input
            type="text"
            value={ref.subtitle || ''}
            onChange={(e) => updateField('subtitle', e.target.value)}
            className={cn(
              'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
              inputBg, borderColor,
  neonFocusClasses,

              'text-[#5A5A40] dark:text-[#E8E6DF]'
            )}
          />
        </div>
      )}

      {/* Journal Title */}
      {showsJournalTitle && (
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
            Título do Periódico *
          </label>
          <input
            type="text"
            value={ref.journalTitle || ''}
            onChange={(e) => updateField('journalTitle', e.target.value)}
            className={cn(
              'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
              inputBg, borderColor,
  neonFocusClasses,

              'text-[#5A5A40] dark:text-[#E8E6DF]'
            )}
          />
        </div>
      )}

      {/* Location / Publisher / Year row */}
      {(showsLocation || showsPublisher || showsYear) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {showsLocation && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Local *
              </label>
              <input
                type="text"
                value={ref.location || ''}
                onChange={(e) => updateField('location', e.target.value)}
                placeholder="Cidade"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsPublisher && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Editora *
              </label>
              <input
                type="text"
                value={ref.publisher || ''}
                onChange={(e) => updateField('publisher', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsYear && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Ano *
              </label>
              <input
                type="text"
                value={ref.year}
                onChange={(e) => updateField('year', e.target.value)}
                placeholder="2024"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* Volume / Number / Pages / Tomo */}
      {(showsVolume || showsNumber || showsPages || config?.optionalFields.includes('tomo')) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {showsVolume && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Volume *
              </label>
              <input
                type="text"
                value={ref.volume || ''}
                onChange={(e) => updateField('volume', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsNumber && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Número *
              </label>
              <input
                type="text"
                value={ref.number || ''}
                onChange={(e) => updateField('number', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsPages && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Páginas *
              </label>
              <input
                type="text"
                value={ref.pages || ''}
                onChange={(e) => updateField('pages', e.target.value)}
                placeholder="10-25"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {config?.optionalFields.includes('tomo') && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Tomo
              </label>
              <input
                type="text"
                value={ref.tomo || ''}
                onChange={(e) => updateField('tomo', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* Month */}
      {config?.optionalFields.includes('month') && (
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
            Mês
          </label>
          <select
            value={ref.month || ''}
            onChange={(e) => updateField('month', e.target.value ? normalizeMonth(e.target.value) : '')}
            className={cn(
              'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
              inputBg, borderColor,
  neonFocusClasses,

              'text-[#5A5A40] dark:text-[#E8E6DF]'
            )}
          >
            <option value="">Selecione...</option>
            <option value="jan.">Janeiro</option>
            <option value="fev.">Fevereiro</option>
            <option value="mar.">Março</option>
            <option value="abr.">Abril</option>
            <option value="mai.">Maio</option>
            <option value="jun.">Junho</option>
            <option value="jul.">Julho</option>
            <option value="ago.">Agosto</option>
            <option value="set.">Setembro</option>
            <option value="out.">Outubro</option>
            <option value="nov.">Novembro</option>
            <option value="dez.">Dezembro</option>
          </select>
        </div>
      )}

      {/* Edition */}
      {config?.optionalFields.includes('edition') && (
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
            Edição
          </label>
          <input
            type="text"
            value={ref.edition || ''}
            onChange={(e) => updateField('edition', e.target.value)}
            placeholder="2. ed."
            className={cn(
              'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
              inputBg, borderColor,
  neonFocusClasses,

              'text-[#5A5A40] dark:text-[#E8E6DF]'
            )}
          />
        </div>
      )}

      {/* DOI / URL / Access Date */}
      {(config?.optionalFields.includes('doi') || showsUrl || showsAccessDate) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {config?.optionalFields.includes('doi') && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                DOI
              </label>
              <input
                type="text"
                value={ref.doi || ''}
                onChange={(e) => updateField('doi', e.target.value)}
                placeholder="10.1000/xyz123"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsUrl && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                URL *
              </label>
              <input
                type="url"
                value={ref.url || ''}
                onChange={(e) => updateField('url', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsAccessDate && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Data de Acesso *
              </label>
              <input
                type="text"
                value={ref.accessDate || ''}
                onChange={(e) => updateField('accessDate', e.target.value)}
                placeholder="dd mês abbr. aaaa"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* Thesis fields */}
      {(showsDegree || showsInstitution) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {showsDegree && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Tipo / Grau *
              </label>
              <input
                type="text"
                value={ref.degree || ''}
                onChange={(e) => updateField('degree', e.target.value)}
                placeholder="Doutorado em..."
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsInstitution && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Instituição *
              </label>
              <input
                type="text"
                value={ref.institution || ''}
                onChange={(e) => updateField('institution', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* Advisor */}
      {config?.optionalFields.includes('advisor') && (
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
            Orientador
          </label>
          <input
            type="text"
            value={ref.advisor || ''}
            onChange={(e) => updateField('advisor', e.target.value)}
            placeholder="Prof. Dr. Nome"
            className={cn(
              'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
              inputBg, borderColor,
  neonFocusClasses,

              'text-[#5A5A40] dark:text-[#E8E6DF]'
            )}
          />
        </div>
      )}

      {/* Conference fields */}
      {(showsEventName || showsEventLocation || showsEventYear || showsBookTitle) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {showsEventName && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Nome do Evento *
              </label>
              <input
                type="text"
                value={ref.eventName || ''}
                onChange={(e) => updateField('eventName', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsEventLocation && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Local do Evento *
              </label>
              <input
                type="text"
                value={ref.eventLocation || ''}
                onChange={(e) => updateField('eventLocation', e.target.value)}
                placeholder="Cidade, UF"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsEventYear && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Ano do Evento *
              </label>
              <input
                type="text"
                value={ref.eventYear || ''}
                onChange={(e) => updateField('eventYear', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsBookTitle && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Título da Publicação *
              </label>
              <input
                type="text"
                value={ref.bookTitle || ''}
                onChange={(e) => updateField('bookTitle', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* Legislation fields */}
      {(showsLegislationType || showsLegislationNumber || showsLegislationSource || showsLegislationDate) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {showsLegislationType && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Tipo *
              </label>
              <select
                value={ref.legislationType || ''}
                onChange={(e) => updateField('legislationType', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              >
                <option value="">Selecione...</option>
                <option value="BRASIL">Brasil</option>
                <option value="Lei">Lei</option>
                <option value="Decreto">Decreto</option>
                <option value="Portaria">Portaria</option>
                <option value="Resolução">Resolução</option>
                <option value="Instrução Normativa">Instrução Normativa</option>
              </select>
            </div>
          )}
          {showsLegislationNumber && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Número *
              </label>
              <input
                type="text"
                value={ref.legislationNumber || ''}
                onChange={(e) => updateField('legislationNumber', e.target.value)}
                placeholder="14.133"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsLegislationSource && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Fonte *
              </label>
              <input
                type="text"
                value={ref.legislationSource || ''}
                onChange={(e) => updateField('legislationSource', e.target.value)}
                placeholder="Diário Oficial da União"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsLegislationDate && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Data *
              </label>
              <input
                type="text"
                value={ref.legislationDate || ''}
                onChange={(e) => updateField('legislationDate', e.target.value)}
                placeholder="1º abr. 2021"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* Standard fields */}
      {(showsStandardNumber || showsStandardOrganization) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {showsStandardOrganization && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Organização *
              </label>
              <input
                type="text"
                value={ref.standardOrganization || ''}
                onChange={(e) => updateField('standardOrganization', e.target.value)}
                placeholder="ABNT"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsStandardNumber && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Número *
              </label>
              <input
                type="text"
                value={ref.standardNumber || ''}
                onChange={(e) => updateField('standardNumber', e.target.value)}
                placeholder="NBR 6023"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* Patent fields */}
      {(showsInventor || showsPatentNumber || showsFilingDate || showsGrantDate) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {showsInventor && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Inventor *
              </label>
              <input
                type="text"
                value={ref.inventor || ''}
                onChange={(e) => updateField('inventor', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsPatentNumber && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Número *
              </label>
              <input
                type="text"
                value={ref.patentNumber || ''}
                onChange={(e) => updateField('patentNumber', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsFilingDate && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Data de Depósito *
              </label>
              <input
                type="text"
                value={ref.filingDate || ''}
                onChange={(e) => updateField('filingDate', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsGrantDate && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Data de Concessão *
              </label>
              <input
                type="text"
                value={ref.grantDate || ''}
                onChange={(e) => updateField('grantDate', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* Audiovisual type */}
      {showsAudiovisualType && (
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
            Tipo *
          </label>
          <select
            value={ref.audiovisualType || ''}
            onChange={(e) => updateField('audiovisualType', e.target.value as ABNTReference['audiovisualType'])}
            className={cn(
              'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
              inputBg, borderColor,
  neonFocusClasses,

              'text-[#5A5A40] dark:text-[#E8E6DF]'
            )}
          >
            <option value="">Selecione...</option>
            <option value="video">Vídeo</option>
            <option value="podcast">Podcast</option>
            <option value="audio">Áudio</option>
            <option value="image">Imagem</option>
          </select>
        </div>
      )}

      {/* Platform / Duration */}
      {config?.optionalFields.includes('platform') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
              Plataforma
            </label>
            <input
              type="text"
              value={ref.platform || ''}
              onChange={(e) => updateField('platform', e.target.value)}
              placeholder="YouTube, Spotify..."
              className={cn(
                'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                inputBg, borderColor,
                neonFocusClasses,
                'text-[#5A5A40] dark:text-[#E8E6DF]'
              )}
            />
          </div>
          {config?.optionalFields.includes('duration') && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Duração
              </label>
              <input
                type="text"
                value={ref.duration || ''}
                onChange={(e) => updateField('duration', e.target.value)}
                placeholder="12:34"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* AI Tool fields */}
      {(showsOrganization || showsAiVersion || showsAiLocation) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {showsOrganization && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Organização *
              </label>
              <input
                type="text"
                value={ref.organization || ''}
                onChange={(e) => updateField('organization', e.target.value)}
                placeholder="OpenAI"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsAiVersion && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Versão *
              </label>
              <input
                type="text"
                value={ref.aiVersion || ''}
                onChange={(e) => updateField('aiVersion', e.target.value)}
                placeholder="GPT-4o"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
          {showsAiLocation && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
                Local *
              </label>
              <input
                type="text"
                value={ref.aiLocation || ''}
                onChange={(e) => updateField('aiLocation', e.target.value)}
                placeholder="São Francisco"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
                  inputBg, borderColor,
  neonFocusClasses,

                  'text-[#5A5A40] dark:text-[#E8E6DF]'
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      <div className={cn(
        'rounded-xl border p-4 transition-colors',
        isDark ? 'bg-[#242720] border-[#393E32]' : 'bg-white border-[#E5E2D9]'
      )}>
        <p className="text-[10px] font-bold text-[#8C897E] dark:text-[#9EA399] uppercase tracking-wider mb-2">
          Preview
        </p>
        <p className="text-sm text-[#5A5A40] dark:text-[#E8E6DF] leading-relaxed">
          {preview || 'Preencha os campos para ver o resultado...'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            'px-4 py-2 text-sm font-bold rounded-xl border transition-colors',
            inputBg, borderColor,
  neonFocusClasses,

            'text-[#8C897E] dark:text-[#9EA399] hover:text-[#5A5A40] dark:hover:text-[#E8E6DF]'
          )}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-bold rounded-xl bg-[#5A5A40] dark:bg-[#9CB386] text-white hover:bg-[#454530] dark:hover:bg-[#7D8861] transition-colors"
        >
          Salvar Referência
        </button>
      </div>
    </form>
  );
}
