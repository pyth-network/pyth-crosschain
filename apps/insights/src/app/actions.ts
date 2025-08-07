'use server';



import { unstable_cacheTag as cacheTag, unstable_cache } from 'next/cache';


export const funcA = async () => {
  "use cache";
  cacheTag('func-a-tag')
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