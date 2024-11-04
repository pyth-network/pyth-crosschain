import path from "node:path";
import { fileURLToPath } from "node:url";

export const tailwindGlob = `${path.dirname(fileURLToPath(import.meta.url))}/**/*.{ts,tsx}`;
