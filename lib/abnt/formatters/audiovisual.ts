'use client';

import { ABNTReference } from '../types';
import { formatAuthorsABNT } from '../parsers/author';

const TYPE_LABELS: Record<string, string> = {
  video: 'Vídeo',
  podcast: 'Podcast',
  audio: 'Áudio',
  image: 'Imagem',
};

export function formatAudiovisual(ref: ABNTReference): string {
  const parts: string[] = [];

  if (ref.authors.length > 0) {
    parts.push(formatAuthorsABNT(ref.authors));
  }

  parts.push(ref.title);

  const typeLabel = ref.audiovisualType
    ? TYPE_LABELS[ref.audiovisualType] || ref.audiovisualType
    : 'Documento audiovisual';

  if (ref.year) parts.push(ref.year);

  if (ref.duration) parts.push(ref.duration);

  if (ref.platform) parts.push(ref.platform);

  if (ref.description) parts.push(typeLabel);

  if (ref.url) parts.push(`Disponível em: ${ref.url}`);

  if (ref.accessDate) parts.push(`Acesso em: ${ref.accessDate}`);

  return parts.join('. ') + '.';
}
