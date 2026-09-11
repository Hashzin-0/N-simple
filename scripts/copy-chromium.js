const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..', 'node_modules', '@sparticuz', 'chromium', 'bin');
const dst = path.resolve(__dirname, '..', '.next', 'standalone', 'node_modules', '@sparticuz', 'chromium', 'bin');

if (!fs.existsSync(src)) {
  console.warn(`[copy-chromium] Source bin/ not found at ${src}, skipping.`);
  process.exit(0);
}

fs.mkdirSync(dst, { recursive: true });

for (const entry of fs.readdirSync(src)) {
  const srcFile = path.join(src, entry);
  const dstFile = path.join(dst, entry);
  fs.copyFileSync(srcFile, dstFile);
  console.log(`[copy-chromium] ${entry} → ${dstFile}`);
}

console.log(`[copy-chromium] Done. Copied ${fs.readdirSync(src).length} files.`);
