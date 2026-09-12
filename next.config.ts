import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' } : {}),
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  transpilePackages: ['motion'],
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    // Belt-and-suspenders: explicitly externalize browser packages at the webpack level
    // to prevent @sparticuz/chromium from being bundled (its __dirname breaks when relocated).
    if (!dev) {
      const chromiumPkgs = ['@sparticuz/chromium', 'puppeteer-core', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth'];
      config.externals = config.externals || [];
      for (const pkg of chromiumPkgs) {
        if (typeof config.externals === 'function') {
          // Wrap the existing externals function
          const prevExternals = config.externals;
          config.externals = async (ctx: any) => {
            const result = await prevExternals(ctx);
            if (result && typeof result === 'object' && !Array.isArray(result)) {
              return { ...result, [pkg]: `commonjs ${pkg}` };
            }
            return result;
          };
        } else if (Array.isArray(config.externals)) {
          if (!config.externals.includes(pkg)) {
            config.externals.push(pkg);
          }
        } else {
          config.externals = [pkg];
        }
      }
    }
    return config;
  },
};

export default nextConfig;
