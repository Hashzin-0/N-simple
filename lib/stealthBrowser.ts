import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteerExtra.use(StealthPlugin());

let browserInstance: Awaited<ReturnType<typeof puppeteerExtra.launch>> | null = null;
let launchPromise: Promise<typeof browserInstance> | null = null;

async function getBrowser() {
  if (browserInstance) {
    const alive = browserInstance.connected;
    if (alive) return browserInstance;
    browserInstance = null;
  }

  if (launchPromise) return launchPromise;

  launchPromise = (async () => {
    try {
      const chromium = await import('@sparticuz/chromium');
      const browser = await puppeteerExtra.launch({
        args: chromium.default.args,
        executablePath: await chromium.default.executablePath(),
        headless: true,
        defaultViewport: { width: 1280, height: 800 },
      });
      browserInstance = browser;
      return browser;
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
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: opts?.timeoutMs ?? 30000,
    });

    if (opts?.waitSelector) {
      try {
        await page.waitForSelector(opts.waitSelector, { timeout: 10000 });
      } catch {
        // continue even if selector not found
      }
    }

    const status = response?.status() ?? 0;
    const html = await page.content();

    return { html, ok: status >= 200 && status < 400, status };
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
