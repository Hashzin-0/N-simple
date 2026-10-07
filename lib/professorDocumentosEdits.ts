import JSZip from 'jszip';
import type { ProfessorDocumentKind } from '@/lib/professorDocumentos';

export type DocumentEdit =
  | {
      type: 'replace_text';
      unit: string;
      targetId: string;
      oldText: string;
      newText: string;
    }
  | {
      type: 'set_transition';
      slide: number;
      transition: 'fade' | 'push' | 'wipe' | 'split' | 'cover' | 'reveal';
      speed?: 'slow' | 'med' | 'fast';
      advanceOnClick?: boolean;
      advanceAfterMs?: number;
    }
  | {
      type: 'add_animation';
      slide: number;
      targetId: string;
      effect: 'fade' | 'blinds' | 'box' | 'fly';
      trigger?: 'click' | 'withPrevious' | 'afterPrevious';
      durationMs?: number;
      delayMs?: number;
    }
  | {
      type: 'remove_animations';
      slide: number;
      targetId?: string;
    };

export interface AppliedEdit {
  edit: DocumentEdit;
  status: 'applied';
}

const esc = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const slidePath = (slide: number) => `ppt/slides/slide${slide}.xml`;

function replacePptxText(xml: string, edit: Extract<DocumentEdit, { type: 'replace_text' }>) {
  const objectRegex = new RegExp(
    `<p:(sp|pic|graphicFrame)(?: [^>]*)?>[\\s\\S]*?<p:cNvPr[^>]*\\bid="${edit.targetId}"[^>]*>[\\s\\S]*?<\\/p:(?:sp|pic|graphicFrame)>`,
    'i',
  );
  const match = xml.match(objectRegex);
  if (!match) throw new Error(`Objeto ${edit.targetId} não encontrado no ${edit.unit}.`);
  const fragment = match[0];
  const runRegex = /<a:t([^>]*)>([\s\S]*?)<\/a:t>/gi;
  let found = false;
  const replaced = fragment.replace(runRegex, (full, attrs, value) => {
    const decoded = value
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    if (!found && decoded.includes(edit.oldText)) {
      found = true;
      return `<a:t${attrs}>${esc(decoded.replace(edit.oldText, edit.newText))}</a:t>`;
    }
    return full;
  });
  if (!found) throw new Error(`O texto alvo não foi encontrado em um único trecho editável de ${edit.unit}.`);
  return xml.replace(fragment, replaced);
}

const transitionXml = (edit: Extract<DocumentEdit, { type: 'set_transition' }>) => {
  const speed = edit.speed || 'med';
  const advClick = edit.advanceOnClick === false ? '0' : '1';
  const advTm = edit.advanceAfterMs && edit.advanceAfterMs > 0 ? ` advTm="${Math.round(edit.advanceAfterMs)}"` : '';
  const effects: Record<string, string> = {
    fade: '<p:fade thruBlk="0"/>',
    push: '<p:push dir="l"/>',
    wipe: '<p:wipe dir="l"/>',
    split: '<p:split orient="vert" dir="out"/>',
    cover: '<p:cover dir="l"/>',
    reveal: '<p:reveal dir="l"/>',
  };
  return `<p:transition spd="${speed}" advClick="${advClick}"${advTm}>${effects[edit.transition]}</p:transition>`;
};

function applyTransition(xml: string, edit: Extract<DocumentEdit, { type: 'set_transition' }>) {
  const without = xml.replace(/<p:transition(?: [^>]*)?>[\s\S]*?<\/p:transition>/i, '');
  const transition = transitionXml(edit);
  if (without.includes('<p:timing')) return without.replace(/<p:timing/, `${transition}<p:timing`);
  if (without.includes('</p:clrMapOvr>')) return without.replace(/<\/p:clrMapOvr>/i, `</p:clrMapOvr>${transition}`);
  return without.replace(/<\/p:cSld>/i, `</p:cSld>${transition}`);
}

function maxTimingId(xml: string) {
  const ids = [...xml.matchAll(/<p:cTn[^>]*\bid="(\d+)"/gi)].map(m => Number(m[1]));
  return Math.max(1, ...ids);
}

function animationXml(edit: Extract<DocumentEdit, { type: 'add_animation' }>, id: number) {
  const dur = Math.max(100, Math.round(edit.durationMs || 700));
  const delay = Math.max(0, Math.round(edit.delayMs || 0));
  const trigger = edit.trigger || 'click';
  const nodeType = trigger === 'withPrevious' ? 'withEffect' : trigger === 'afterPrevious' ? 'afterEffect' : 'clickEffect';
  const stCond = trigger === 'click'
    ? '<p:stCondLst><p:cond delay="indefinite" evt="onBegin"/></p:stCondLst>'
    : delay > 0
      ? `<p:stCondLst><p:cond delay="${delay}"/></p:stCondLst>`
      : '';
  const filter = edit.effect === 'blinds' ? 'blinds(horizontal)' : edit.effect === 'box' ? 'box(in)' : edit.effect === 'fly' ? 'fly(in)' : 'fade';
  return `<p:par><p:cTn id="${id}" dur="${dur + delay}" nodeType="${nodeType}" restart="whenNotActive">${stCond}<p:childTnLst><p:animEffect transition="in" filter="${filter}"><p:cBhvr><p:cTn id="${id + 1}" dur="${dur}" /><p:tgtEl><p:spTgt spid="${esc(edit.targetId)}"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par>`;
}

function ensureTiming(xml: string) {
  if (/<p:timing[ >]/i.test(xml)) return xml;
  const timing = '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst/></p:cTn></p:par></p:tnLst></p:timing>';
  if (/<p:clrMapOvr[ >]/i.test(xml)) return xml.replace(/<\/p:clrMapOvr>/i, `</p:clrMapOvr>${timing}`);
  return xml.replace(/<\/p:sld>/i, `${timing}</p:sld>`);
}

function addAnimation(xml: string, edit: Extract<DocumentEdit, { type: 'add_animation' }>) {
  const result = ensureTiming(xml);
  const nextId = maxTimingId(result) + 1;
  const node = animationXml(edit, nextId);
  if (/<p:childTnLst[ >][\s\S]*?<\/p:childTnLst>/i.test(result)) {
    return result.replace(/<p:childTnLst( [^>]*)?>([\s\S]*?)<\/p:childTnLst>/i, (full, attrs, body) =>
      `<p:childTnLst${attrs || ''}>${body}${node}</p:childTnLst>`,
    );
  }
  return result.replace(/<p:cTn([^>]*)\/>/i, (full, attrs) =>
    `<p:cTn${attrs}><p:childTnLst>${node}</p:childTnLst></p:cTn>`,
  );
}
function removeAnimations(xml: string, edit: Extract<DocumentEdit, { type: 'remove_animations' }>) {
  const timingMatch = xml.match(/<p:timing[ >][\s\S]*?<\/p:timing>/i);
  if (!timingMatch) return xml;
  let timing = timingMatch[0];
  if (edit.targetId) {
    const nodeRegex = new RegExp(`<p:par>[\\s\\S]*?<p:spTgt[^>]*\\bspid="${edit.targetId}"[^>]*/>[\\s\\S]*?<\\/p:par>`, 'gi');
    timing = timing.replace(nodeRegex, '');
  } else {
    timing = '';
  }
  return xml.replace(timingMatch[0], timing);
}

export async function applyDocumentEdits(
  buffer: Buffer,
  kind: ProfessorDocumentKind,
  edits: DocumentEdit[],
) {
  if (!edits.length) throw new Error('Nenhuma alteração foi solicitada.');
  const zip = await JSZip.loadAsync(buffer);

  if (kind === 'docx') {
    const file = zip.file('word/document.xml');
    if (!file) throw new Error('O DOCX não contém word/document.xml.');
    let xml = await file.async('text');
    for (const edit of edits) {
      if (edit.type !== 'replace_text') {
        throw new Error(`A alteração "${edit.type}" não é compatível com Word nesta versão.`);
      }
      const paragraphNumber = Number(edit.targetId.replace('paragraph-', ''));
      const paragraphs = [...xml.matchAll(/<w:p(?: [^>]*)?>[\s\S]*?<\/w:p>/gi)];
      const paragraph = paragraphs[paragraphNumber - 1]?.[0];
      if (!paragraph) throw new Error(`Parágrafo ${paragraphNumber} não encontrado.`);
      const runRegex = /<w:t([^>]*)>([\s\S]*?)<\/w:t>/gi;
      let found = false;
      const replaced = paragraph.replace(runRegex, (full, attrs, value) => {
        const decoded = value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
        if (!found && decoded.includes(edit.oldText)) {
          found = true;
          return `<w:t${attrs} xml:space="preserve">${esc(decoded.replace(edit.oldText, edit.newText))}</w:t>`;
        }
        return full;
      });
      if (!found) throw new Error(`O texto alvo não foi encontrado em um único trecho do Parágrafo ${paragraphNumber}.`);
      xml = xml.replace(paragraph, replaced);
    }
    zip.file('word/document.xml', xml);
  } else {
    for (const edit of edits) {
      const slide = 'slide' in edit ? edit.slide : 0;
      const file = zip.file(slidePath(slide));
      if (!file) throw new Error(`Slide ${slide} não encontrado.`);
      let xml = await file.async('text');
      if (edit.type === 'replace_text') xml = replacePptxText(xml, edit);
      else if (edit.type === 'set_transition') xml = applyTransition(xml, edit);
      else if (edit.type === 'add_animation') xml = addAnimation(xml, edit);
      else if (edit.type === 'remove_animations') xml = removeAnimations(xml, edit);
      zip.file(slidePath(slide), xml);
    }
  }

  return {
    buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
    applied: edits.map(edit => ({ edit, status: 'applied' as const })) as AppliedEdit[],
  };
}
