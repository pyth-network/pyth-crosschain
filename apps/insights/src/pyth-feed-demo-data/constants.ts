import path from "node:path";

export const COMPRESSED_DB_PATH = path.join(
  process.cwd(),
  "public",
  "db",
  "historical-demo-data.db.br",
);

// this needs to be located in the /tmp folder because Vercel
// makes all other directories read-only
export const UNCOMPRESSED_DB_PATH = path.join(
  "/tmp",
  path.basename(COMPRESSED_DB_PATH).replace(/\.br$/, ""),
);
