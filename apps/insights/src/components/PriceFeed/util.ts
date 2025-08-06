import { unstable_cache } from 'next/cache';

export const funcA = async () => {
  "use cache";
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return Math.random();
}


const rand = async () => {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return Math.random();
}

export const funcAUnstableCache = unstable_cache(
  rand,
  [], // cache keys here; leave [] for simple global cache
  { revalidate: 60 }, // revalidate period in seconds, or use false for infinite
);