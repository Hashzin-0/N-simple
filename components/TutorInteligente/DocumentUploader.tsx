'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Trash2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TutorDocumentDto {
  id: string;
  name: string;
  pages: number | null;
  char_count: number;
  status: 'processing' | 'ready' | 'failed';
  digest: { resumo?: string; topicos?: string[] } | null;
}

interface DocumentUploaderProps {
  userId?: string | null;
  className?: string;
}

async function fetchDocuments(userId?: string | null): Promise<TutorDocumentDto[]> {
  try {
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await fetch(`/api/tutor/documents${qs}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { documents?: TutorDocumentDto[] };
    return data.documents ?? [];
  } catch {
    return [];
  }
}

export default function DocumentUploader({ userId, className }: DocumentUploaderProps) {
  const [docs, setDocs] = useState<TutorDocumentDto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    void fetchDocuments(userId).then((list) => {
      if (mountedRef.current) setDocs(list);
    });
    return () => {
      mountedRef.current = false;
    };
  }, [userId]);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      setProgress(8);
      try {
        const form = new FormData();
        form.append('file', file);
        if (userId) form.append('userId', userId);

        const res = await fetch('/api/tutor/documents', { method: 'POST', body: form });
        setProgress(100);
        const data = (await res.json().catch(() => ({}))) as {
          document?: TutorDocumentDto;
          error?: string;
        };
        if (!res.ok || !data.document) {
          setError(data.error || 'Falha ao enviar o arquivo.');
        } else {
          setDocs((prev) => [data.document!, ...prev.filter((d) => d.id !== data.document!.id)]);
        }
      } catch {
        setError('Falha de rede ao enviar o arquivo.');
      } finally {
        setUploading(false);
        setProgress(0);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [userId]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) void uploadFile(file);
    },
    [uploadFile]
  );

  const handleRemove = useCallback(async (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    try {
      await fetch(`/api/tutor/documents?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      // remoção otimista — mantém fora da lista
    }
  }, []);

  return (
    <div id="tutor_documents" className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[#242A20] dark:text-[#F3F1EC]">
          Material de apoio
        </p>
        <span className="text-[10px] text-[#8C897E] dark:text-[#9EA399]">
          PDF, TXT, MD ou CSV · até 20MB
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!uploading) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'rounded-2xl border-2 border-dashed px-4 py-5 text-center transition-colors',
          dragging
            ? 'border-[#2E6F40] bg-[#2E6F40]/5 dark:border-[#9CB386] dark:bg-[#9CB386]/10'
            : 'border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A]'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md,.csv,application/pdf,text/plain,text/markdown"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          aria-label="Enviar documento"
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="size-5 animate-spin text-[#2E6F40] dark:text-[#9CB386]" />
            <p className="text-xs text-[#5A5A40] dark:text-[#9EA399]">
              Enviando e entendendo o material… {progress > 0 ? `${progress}%` : ''}
            </p>
            <div className="h-1 w-48 rounded-full bg-[#E5E2D9] dark:bg-[#2C3328] overflow-hidden">
              <div
                className="h-full bg-[#2E6F40] dark:bg-[#9CB386] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            id="tutor_upload_trigger"
            onClick={() => inputRef.current?.click()}
            className="inline-flex flex-col items-center gap-1.5 w-full"
          >
            <Upload className="size-5 text-[#2E6F40] dark:text-[#9CB386]" />
            <span className="text-xs font-medium text-[#5A5A40] dark:text-[#9EA399]">
              Envie um PDF — leio, entendo e faço perguntas sobre ele
            </span>
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-2 flex items-start gap-2">
          <X className="size-3.5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {docs.length > 0 && (
        <ul className="space-y-1.5">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex items-start gap-2 rounded-xl border border-[#E5E2D9] dark:border-[#2C3328] bg-[#F3F1EC]/60 dark:bg-[#2C3328]/50 px-3 py-2"
            >
              <FileText className="size-3.5 mt-0.5 text-[#2E6F40] dark:text-[#9CB386] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-[#242A20] dark:text-[#F3F1EC] truncate">
                  {doc.name}
                </p>
                <p className="text-[10px] text-[#8C897E] dark:text-[#9EA399] truncate">
                  {doc.status === 'ready'
                    ? [
                        doc.pages ? `${doc.pages} pág.` : null,
                        doc.digest?.topicos?.length
                          ? doc.digest.topicos.slice(0, 3).join(' · ')
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' — ') || 'pronto'
                    : doc.status === 'processing'
                      ? 'processando…'
                      : 'falhou'}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remover ${doc.name}`}
                onClick={() => void handleRemove(doc.id)}
                className="p-1 rounded-md text-[#8C897E] dark:text-[#9EA399] hover:text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
