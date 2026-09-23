import type {Metadata, Viewport} from 'next';
import { Inter } from 'next/font/google';
import './globals.css'; // Global styles
import { ThemeProvider } from '@/components/ThemeProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2E6F40',
};

export const metadata: Metadata = {
  title: 'Calculadora de Nitrogênio para Milho',
  description: 'Calculadora agronômica de adubação nitrogenada e estimativa de produtividade de milho por estande, grãos, PMG e quebra com tema escuro e visualizador.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'N-Pro',
  },
  openGraph: {
    title: 'Calculadora de Nitrogênio para Milho',
    description: 'Calculadora agronômica de adubação nitrogenada e estimativa de produtividade de milho por estande, grãos, PMG e quebra com tema escuro e visualizador.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calculadora de Nitrogênio para Milho',
    description: 'Calculadora agronômica de adubação nitrogenada e estimativa de produtividade de milho por estande, grãos, PMG e quebra com tema escuro e visualizador.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} overflow-x-hidden`}>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('agronomica_theme');
                var d = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (t === 'dark' || (!t && d)) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              } catch (e) {}
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
        <script src="https://vlibras.gov.br/app/vlibras-plugin.js" defer></script>
      </head>
      <body suppressHydrationWarning className="antialiased transition-colors duration-300 overflow-x-hidden">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
