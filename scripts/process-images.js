#!/usr/bin/env node
/**
 * Run this script once when real images are ready.
 * It generates WebP versions at mobile-optimized sizes.
 *
 * Usage:
 *   npm install --save-dev sharp
 *   node scripts/process-images.js
 *
 * Input:
 *   public/family.jpg         (your actual family photo)
 *   public/photos/01.jpg … 42.jpg
 *
 * Output (written in-place as .jpg — Amplify serves them directly):
 *   public/family.jpg         → resized to 900px wide, quality 85
 *   public/photos/NN.jpg      → resized to 800px wide, quality 82
 */

import sharp from 'sharp';
import { readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

async function processFamily() {
  const src = path.join(publicDir, 'family.jpg');
  await sharp(src)
    .resize({ width: 900, withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(src + '.tmp');
  const { rename } = await import('fs/promises');
  await rename(src + '.tmp', src);
  console.log('Processed family.jpg');
}

async function processPhotos() {
  const photosDir = path.join(publicDir, 'photos');
  const files = (await readdir(photosDir)).filter((f) => /^\d{2}\.jpg$/.test(f));
  await Promise.all(
    files.map(async (f) => {
      const src = path.join(photosDir, f);
      await sharp(src)
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(src + '.tmp');
      const { rename } = await import('fs/promises');
      await rename(src + '.tmp', src);
      console.log(`Processed ${f}`);
    })
  );
}

try {
  await processFamily();
  await processPhotos();
  console.log('Done. All images optimized.');
} catch (err) {
  console.error('Error processing images:', err.message);
  process.exit(1);
}
