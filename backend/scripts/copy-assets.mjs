import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// copy-assets.mjs — cross-platform post-build step.
//
// Copies non-TypeScript assets (SQL migrations) from src/ to dist/ so the
// compiled server can find them at runtime.  Works on Windows, macOS, and
// Linux without relying on shell commands like `cp` or `copy`.
//
// Run automatically as part of `npm run build` (after `tsc`).
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, '..', 'src');
const distDir = resolve(__dirname, '..', 'dist');

const ASSET_DIRS = [
  { src: 'db/migrations', dest: 'db/migrations' },
];

function copyDir(srcRel, destRel) {
  const srcPath = resolve(srcDir, srcRel);
  const destPath = resolve(distDir, destRel);

  if (!existsSync(srcPath)) {
    console.warn('Warning: source directory not found: ' + srcPath);
    return;
  }

  mkdirSync(destPath, { recursive: true });

  for (const entry of readdirSync(srcPath)) {
    const srcFile = resolve(srcPath, entry);
    const destFile = resolve(destPath, entry);

    if (statSync(srcFile).isDirectory()) {
      copyDir(join(srcRel, entry), join(destRel, entry));
    } else {
      copyFileSync(srcFile, destFile);
      console.log('  copied: ' + destRel + '/' + entry);
    }
  }
}

console.log('Copying non-TS assets to dist/...');
for (const { src, dest } of ASSET_DIRS) {
  copyDir(src, dest);
}
console.log('Done.');
