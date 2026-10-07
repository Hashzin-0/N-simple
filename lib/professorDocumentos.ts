import JSZip from 'jszip';

export type ProfessorDocumentKind = 'docx' | 'pptx';

export interface ExtractedAsset {
  path: string;
  mimeType: string;
  size: number;
  base64?: string;
}

export interface EditableTarget {
  unit: string;
  objectId: string;
  name: string;
  type: 'shape' | 'image' | 'table' | 'graphic';
  text: string;
  runs?: Array<{ text: string; index: number }>;
}

export interface DocumentStructure {
  kind: ProfessorDocumentKind;
  title: string;
  paragraphs: number;
  tables: number;
  slides: number;
  headings: string[];
  textByUnit: Array<{ unit: string; text: string }>;
  images: Array<{ path: string; mimeType: string; size: number }>;
  animations: number;
  transitions: number;
  notes: number;
  rawText: string;
  editableTargets: EditableTarget[];
}

const mimeFor = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase();
  return ext === 'png' ? 'image/png'
    : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'gif' ? 'image/gif'
    : ext === 'webp' ? 'image/webp'
    : ext === 'svg' ? 'image/svg+xml'
    : 'application/octet-stream';
};

const decodeXml = (value: string) => value
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'");

const xmlText = (xml: string) => xml
  .replace(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi, '$1')
  .replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const uniqueNonEmpty = (items: string[]) => [...new Set(items.map(s => s.trim()).filter(Boolean))];

async function readAssets(zip: JSZip, includeBytes: boolean): Promise<ExtractedAsset[]> {
  const assets: ExtractedAsset[] = [];
  const entries = Object.entries(zip.files)
    .filter(([path, file]) => !file.dir && path.startsWith('word/media/'))
    .concat(Object.entries(zip.files).filter(([path, file]) => !file.dir && path.startsWith('ppt/media/')));

  for (const [path, file] of entries) {
    const data = await file.async('nodebuffer');
    assets.push({
      path,
      mimeType: mimeFor(path),
      size: data.byteLength,
      ...(includeBytes ? { base64: data.toString('base64') } : {}),
    });
  }
  return assets;
}

async function parseDocx(zip: JSZip): Promise<{ structure: DocumentStructure; assets: ExtractedAsset[] }> {
  const documentXml = zip.file('word/document.xml') ? await zip.file('word/document.xml')!.async('text') : '';
  const headers = Object.entries(zip.files).filter(([p, f]) => !f.dir && /^word\/header\d+\.xml$/.test(p));
  const footers = Object.entries(zip.files).filter(([p, f]) => !f.dir && /^word\/footer\d+\.xml$/.test(p));

  const bodyParagraphs = [...documentXml.matchAll(/<w:p(?: [^>]*)?>([\s\S]*?)<\/w:p>/gi)]
    .map(m => xmlText(m[1]));

  const headingValues = [...documentXml.matchAll(/<w:p(?: [^>]*)?>([\s\S]*?)<\/w:p>/gi)]
    .map(m => /w:val="Heading [1-6]"/i.test(m[1]) ? xmlText(m[1]) : '');

  const tables = (documentXml.match(/<w:tbl(?: [^>]*)?>/gi) || []).length;
  const textByUnit: Array<{ unit: string; text: string }> = [];
  const editableTargets: EditableTarget[] = [];

  bodyParagraphs.forEach((text, i) => {
    if (text) {
      textByUnit.push({ unit: `Parágrafo ${i + 1}`, text });
      editableTargets.push({
        unit: `Parágrafo ${i + 1}`,
        objectId: `paragraph-${i + 1}`,
        name: `Parágrafo ${i + 1}`,
        type: 'shape',
        text,
      });
    }
  });

  for (const [path, file] of [...headers, ...footers]) {
    const text = xmlText(await file.async('text'));
    if (text) textByUnit.push({ unit: path.split('/').pop() || path, text });
  }

  const assets = await readAssets(zip, true);
  const visualAssets = assets.filter(a => a.base64 && a.size <= 4_000_000).slice(0, 40);
  const title = uniqueNonEmpty(headingValues)[0] || bodyParagraphs.find(Boolean) || 'Documento Word';
  const rawText = textByUnit.map(x => `[${x.unit}] ${x.text}`).join('\n');

  return {
    structure: {
      kind: 'docx',
      title,
      paragraphs: bodyParagraphs.filter(Boolean).length,
      tables,
      slides: 0,
      headings: uniqueNonEmpty(headingValues).slice(0, 80),
      textByUnit: textByUnit.slice(0, 500),
      images: assets.map(({ path, mimeType, size }) => ({ path, mimeType, size })),
      animations: 0,
      transitions: 0,
      notes: 0,
      rawText: rawText.slice(0, 150_000),
      editableTargets,
    },
    assets: visualAssets,
  };
}

function extractPptxTargets(xml: string, slideNumber: number): EditableTarget[] {
  const targets: EditableTarget[] = [];
  const fragmentRegex = /<p:(sp|pic|graphicFrame)(?: [^>]*)?>[\s\S]*?<\/p:\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = fragmentRegex.exec(xml))) {
    const fragment = match[0];
    const idMatch = fragment.match(/<p:cNvPr[^>]*\bid="([^"]+)"[^>]*\bname="([^"]*)"/i);
    if (!idMatch) continue;
    const type = match[1].toLowerCase() === 'pic' ? 'image' : match[1].toLowerCase() === 'graphicframe' ? 'graphic' : 'shape';
    const runs = [...fragment.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi)].map((m, index) => ({
      text: decodeXml(m[1]),
      index,
    }));
    const text = runs.map(r => r.text).join(' ').replace(/\s+/g, ' ').trim();
    targets.push({
      unit: `Slide ${slideNumber}`,
      objectId: idMatch[1],
      name: decodeXml(idMatch[2]),
      type,
      text,
      runs,
    });
  }
  return targets;
}

async function parsePptx(zip: JSZip): Promise<{ structure: DocumentStructure; assets: ExtractedAsset[] }> {
  const slideEntries = Object.entries(zip.files)
    .filter(([p, f]) => !f.dir && /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = Number(a[0].match(/slide(\d+)\.xml$/)?.[1] || 0);
      const nb = Number(b[0].match(/slide(\d+)\.xml$/)?.[1] || 0);
      return na - nb;
    });

  const textByUnit: Array<{ unit: string; text: string }> = [];
  const headings: string[] = [];
  const editableTargets: EditableTarget[] = [];
  let animations = 0;
  let transitions = 0;

  for (let i = 0; i < slideEntries.length; i++) {
    const [, file] = slideEntries[i];
    const xml = await file.async('text');
    const text = xmlText(xml);
    if (text) textByUnit.push({ unit: `Slide ${i + 1}`, text });
    const titleMatch = xml.match(/<p:sp[^>]*>[\s\S]*?<p:nvPr>\s*<p:ph[^>]*type="title"[^>]*>[\s\S]*?<\/p:nvPr>[\s\S]*?<\/p:sp>/i);
    if (titleMatch) {
      const title = xmlText(titleMatch[0]);
      if (title) headings.push(title);
    }
    editableTargets.push(...extractPptxTargets(xml, i + 1));
    animations += (xml.match(/<p:timing[ >]/gi) || []).length;
    transitions += (xml.match(/<p:transition[ >]/gi) || []).length;

    const notesPath = `ppt/notesSlides/notesSlide${i + 1}.xml`;
    if (zip.file(notesPath)) {
      const notes = xmlText(await zip.file(notesPath)!.async('text'));
      if (notes) textByUnit.push({ unit: `Notas do slide ${i + 1}`, text: notes });
    }
  }

  const assets = await readAssets(zip, true);
  const title = headings[0] || textByUnit[0]?.text || 'Apresentação PowerPoint';
  const rawText = textByUnit.map(x => `[${x.unit}] ${x.text}`).join('\n');
  const tables = (await Promise.all(slideEntries.map(async ([, file]) =>
    (await file.async('text')).match(/<a:tbl[ >]/gi)?.length || 0
  ))).reduce((a, b) => a + b, 0);

  return {
    structure: {
      kind: 'pptx',
      title,
      paragraphs: 0,
      tables,
      slides: slideEntries.length,
      headings: uniqueNonEmpty(headings).slice(0, 80),
      textByUnit: textByUnit.slice(0, 500),
      images: assets.map(({ path, mimeType, size }) => ({ path, mimeType, size })),
      animations,
      transitions,
      notes: textByUnit.filter(x => x.unit.startsWith('Notas')).length,
      rawText: rawText.slice(0, 180_000),
      editableTargets,
    },
    assets: assets.filter(a => a.base64 && a.size <= 4_000_000).slice(0, 50),
  };
}

export async function inspectOfficeDocument(buffer: Buffer, fileName: string) {
  const zip = await JSZip.loadAsync(buffer);
  const kind: ProfessorDocumentKind = fileName.toLowerCase().endsWith('.pptx') ? 'pptx' : 'docx';
  return kind === 'pptx' ? parsePptx(zip) : parseDocx(zip);
}
