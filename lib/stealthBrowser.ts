import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteerExtra.use(StealthPlugin());

let chromiumUnavailable = false;
let browserInstance: Awaited<ReturnType<typeof puppeteerExtra.launch>> | null = null;
let launchPromise: Promise<typeof browserInstance> | null = null;

export function isBrowserAvailable(): boolean {
  return !chromiumUnavailable;
}

async function getBrowser() {
  if (chromiumUnavailable) return null;

  if (browserInstance) {
    const alive = browserInstance.connected;
    if (alive) return browserInstance;
    browserInstance = null;
  }

  if (launchPromise) return launchPromise;

  launchPromise = (async () => {
    try {
      const chromium = await import('@sparticuz/chromium');
      const execPath = process.env.CHROMIUM_BIN_PATH || await chromium.default.executablePath();
      const browser = await puppeteerExtra.launch({
        args: chromium.default.args,
        executablePath: execPath,
        headless: true,
        defaultViewport: { width: 1280, height: 800 },
      });
      browserInstance = browser;
      return browser;
    } catch (err) {
      chromiumUnavailable = true;
      console.warn('[StealthBrowser] Chromium unavailable, marking as disabled:', err instanceof Error ? err.message : err);
      return null;
    } finally {
      launchPromise = null;
    }
  })();

  return launchPromise;
}

export interface StealthFetchResult {
  html: string;
  ok: boolean;
  status: number;
}

export async function stealthFetch(
  url: string,
  opts?: { waitSelector?: string; timeoutMs?: number }
): Promise<StealthFetchResult> {
  const browser = await getBrowser();
  if (!browser) {
    return { html: '', ok: false, status: 0 };
  }
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    const timeout = opts?.timeoutMs ?? 30000;
    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout,
    });

    // Wait for anti-bot challenge pages to resolve (e.g. Bunny Shield, Cloudflare).
    // These pages load a JS challenge, set a cookie, then reload.
    const pageUrl = page.url();
    const isChallengePage =
      pageUrl.includes('challenge') ||
      (await page.content()).includes('shield-challenge') ||
      (await page.content()).includes('Verificando');
    if (isChallengePage) {
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
      } catch {
        // challenge may not redirect — continue with current content
      }
    }

    if (opts?.waitSelector) {
      try {
        await page.waitForSelector(opts.waitSelector, { timeout: 10000 });
      } catch {
        // continue even if selector not found
      }
    }

    const status = response?.status() ?? 0;
    const html = await page.content();

    // After anti-bot challenges resolve, the initial status may be stale.
    // Re-check: if we have substantial HTML, treat as success.
    const finalOk = (status >= 200 && status < 400) || html.length > 10000;

    return { html, ok: finalOk, status: finalOk ? 200 : status };
  } finally {
    await page.close();
  }
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
