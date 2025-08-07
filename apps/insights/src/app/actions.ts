'use server';



import fs from 'node:fs';
import path from 'node:path';

import { unstable_cacheTag as cacheTag, unstable_cache } from 'next/cache';

// eslint-disable-next-line @typescript-eslint/require-await
export async function logIncrementalCacheFile() {
   const filePath = path.join(
    process.cwd(),
    'node_modules/next/dist/server/lib/incremental-cache/index.js'
  );
  const content = fs.readFileSync(filePath, 'utf8');
  // eslint-disable-next-line no-console, @typescript-eslint/restrict-template-expressions
  console.log(`---------- index.js content: ---------- ${content}`);
}


export const funcA = async () => {
  "use cache";
  cacheTag('func-a-tag')
  await logIncrementalCacheFile();
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return Math.random();
}


const rand = async () => {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return Math.random();
}

export const funcAUnstableCache = unstable_cache(
  rand,
  ['specific-key'], // cache keys here; leave [] for simple global cache
  { revalidate: 600 }, // revalidate period in seconds, or use false for infinite
);