#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// on MacOS, if an environment variable contains a dollar sign $ in it,
// the next.js dotenv-expand library will treat this as a shell variable
// and attempt to inject some value in it, which will ruin things like
// DB passwords. There is no way to disable this behavior, and adding a backslash
// to the dollar signs to the values we have saved in Vercel causes things to break completely
// when deployed because the behavior differs in the shell used on a deployed server
// vs MacOS.
// As such, we need to manually find / replace dollar signs
// in local .env.local files after vercel pulls.
// only use this script if you konw you need it.

const platform = os.platform();

if (platform === "darwin") {
  const localEnvFile = path.join(process.cwd(), ".env.local");

  try {
    const stat = fs.statSync(localEnvFile);
    if (stat.isFile()) {
      let contents = fs.readFileSync(localEnvFile, "utf-8");
      contents = contents.replaceAll(/\$/gm, "\\$");
      fs.writeFileSync(localEnvFile, contents, "utf-8");
      console.info(`fixed ${localEnvFile} file`);
    }
  } catch (error) {
    console.error(error);
  }
}
