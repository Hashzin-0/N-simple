'use client';

import { ABNTReference } from '../types';

export function formatLegislation(ref: ABNTReference): string {
  const parts: string[] = [];

  parts.push(ref.legislationType || 'BRASIL');

  if (ref.legislationNumber) parts.push(ref.legislationNumber);

  if (ref.legislationSource) parts.push(ref.legislationSource);

  if (ref.legislationDate) parts.push(ref.legislationDate);

  if (ref.legislationEmenta) parts.push(ref.legislationEmenta);

  return parts.join('. ') + '.';
}

export function formatTechnicalStandard(ref: ABNTReference): string {
  const parts: string[] = [];

  parts.push(ref.standardOrganization || 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS');

  parts.push(ref.title);

  if (ref.standardNumber) parts.push(ref.standardNumber);

  if (ref.location) parts.push(ref.location);

  parts.push(ref.year);

  return parts.join('. ') + '.';
}

export function formatPatent(ref: ABNTReference): string {
  const parts: string[] = [];

  parts.push(ref.inventor || '');

  parts.push(ref.title);

  if (ref.patentNumber) parts.push(ref.patentNumber);

  if (ref.filingDate) parts.push(ref.filingDate);

  if (ref.grantDate) parts.push(`Concedida em: ${ref.grantDate}`);

  return parts.join('. ') + '.';
}
