import { ScientificSource } from '@/components/PesquisadorAgro/types';

export function deduplicateSources(sources: ScientificSource[]): ScientificSource[] {
  const seen = new Map<string, ScientificSource>();

  for (const src of sources) {
    const key = src.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 80);

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, src);
    } else {
      if (src.abstract.length > existing.abstract.length) {
        seen.set(key, src);
      }
      const merged = seen.get(key)!;
      if (src.matchedTopics && src.matchedTopics.length > 0) {
        const existingTopics = new Set(merged.matchedTopics || []);
        for (const t of src.matchedTopics) {
          existingTopics.add(t);
        }
        merged.matchedTopics = Array.from(existingTopics);
      }
    }
  }

  return Array.from(seen.values());
}
