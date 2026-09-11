/**
 * Image resolution utility for academic paper sources.
 * Tries multiple strategies to find an image for each result:
 *   1. imageUrl from the API (if available)
 *   2. OpenGraph scrape of the paper's landing page (og:image)
 *   3. Google Favicon API for the publisher domain
 *   4. DOI badge (always available for DOI-bearing papers)
 */

const OG_CACHE: Map<string, string> = new Map();

function extractDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

async function fetchOgImage(url: string): Promise<string | undefined> {
  if (OG_CACHE.has(url)) return OG_CACHE.get(url);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NPro/1.0)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(4000),
      redirect: 'follow',
    });

    if (!response.ok) return undefined;

    const html = await response.text();
    const head = html.slice(0, 5000);

    const ogMatch = head.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    ) || head.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    );
    if (ogMatch?.[1]) {
      OG_CACHE.set(url, ogMatch[1]);
      return ogMatch[1];
    }

    const twMatch = head.match(
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
    ) || head.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i
    );
    if (twMatch?.[1]) {
      OG_CACHE.set(url, twMatch[1]);
      return twMatch[1];
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

function getDoiBadge(doi: string): string {
  const encoded = encodeURIComponent(doi);
  return `https://img.shields.io/badge/DOI-${encoded}-blue?logo=doi&logoColor=white`;
}

/**
 * Resolve an image URL for a source.
 * Tries: directUrl OG → domain favicon → DOI badge.
 */
export async function resolveImageUrl(
  directUrl: string | undefined,
  doi: string | undefined
): Promise<string | undefined> {
  // 1. Try OG image from the paper's landing page
  if (directUrl) {
    const og = await fetchOgImage(directUrl);
    if (og) return og;

    // 2. Favicon of the domain
    const domain = extractDomain(directUrl);
    if (domain) {
      return getFaviconUrl(domain);
    }
  }

  // 3. DOI badge (always works)
  if (doi) {
    return getDoiBadge(doi);
  }

  return undefined;
}
