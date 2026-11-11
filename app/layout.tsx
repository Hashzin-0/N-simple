import type {Metadata, Viewport} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import './design-system.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { getPublicAuthConfig } from '@/lib/authConfig';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#286b45',
};

export const metadata: Metadata = {
  title: 'N-simple — Ferramentas para o Agro',
  description: 'Ferramentas agronômicas, pesquisa científica, tutor inteligente e recursos de aprendizagem para o agronegócio.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'N-simple',
  },
  openGraph: {
    title: 'N-simple — Ferramentas para o Agro',
    description: 'Ferramentas agronômicas, pesquisa científica, tutor inteligente e recursos de aprendizagem para o agronegócio.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'N-simple — Ferramentas para o Agro',
    description: 'Ferramentas agronômicas, pesquisa científica, tutor inteligente e recursos de aprendizagem para o agronegócio.',
  },
};

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const authConfig = await getPublicAuthConfig();

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
          <AuthProvider config={authConfig}>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
