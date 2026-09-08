'use client';

import { ABNTReference } from '../types';

export function formatAITool(ref: ABNTReference): string {
  const parts: string[] = [];

  parts.push(ref.organization || '');

  parts.push(ref.title);

  if (ref.aiVersion) parts.push(ref.aiVersion);

  if (ref.aiLocation) parts.push(`[${ref.aiLocation}]`);

  parts.push(ref.year);

  if (ref.aiModel) parts.push(ref.aiModel);

  if (ref.url) parts.push(`Disponível em: ${ref.url}`);

  if (ref.accessDate) parts.push(`Acesso em: ${ref.accessDate}`);

  return parts.join('. ') + '.';
}
