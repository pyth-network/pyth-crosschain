// this rule is absolutely broken for the typings the prompts library
// provides, so we need to hard-disable it for all usages of prompts

import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

import appRootPath from "app-root-path";
import chalk from "chalk";
import glob from "fast-glob";
import fs from "fs-extra";
import { render as renderTemplate } from "micromustache";
import prompts from "prompts";
import type { PackageJson } from "type-fest";

import { getAvailableFolders } from "./get-available-folders.js";
import { Logger } from "./logger.js";
import type {
  CreatePythAppResponses,
  InProgressCreatePythAppResponses,
} from "./types.js";
import { PACKAGE_PREFIX, PackageType, TEMPLATES_FOLDER } from "./types.js";

/**
 * returns the folder that holds the correct templates, based on the user's
 * package choice
 */
function getTemplatesInputFolder(packageType: PackageType) {
  switch (packageType) {
    case PackageType.CLI: {
      return path.join(TEMPLATES_FOLDER, "cli");
    }
    case PackageType.LIBRARY: {
      return path.join(TEMPLATES_FOLDER, "library");
    }
    case PackageType.WEBAPP: {
      return path.join(TEMPLATES_FOLDER, "web-app");
    }
    default: {
      throw new Error(
        `unsupported package type of "${String(packageType)}" was found`,
      );
    }
  }
}

async function createPythApp() {
  const { confirm, description, folder, isPublic, packageName, packageType } =
    (await prompts([
      {
        choices: Object.values(PackageType).map((val) => ({
          title: val,
          value: val,
        })),
        message: "Which type of package do you want to create?",
        name: "packageType",
        type: "select",
      },
      {
        format: (val: string) => `${PACKAGE_PREFIX}${val}`,
        message: (_, responses: InProgressCreatePythAppResponses) =>
          `Enter the name for your ${responses.packageType ?? ""} package. ${chalk.magenta(PACKAGE_PREFIX)}`,
        name: "packageName",
        type: "text",
        validate: (name: string) => {
          const proposedName = `${PACKAGE_PREFIX}${name}`;
          const pjsonNameRegexp = /^@pythnetwork\/(\w)(\w|\d|_|-)+$/;
          return (
            pjsonNameRegexp.test(proposedName) ||
            "Please enter a valid package name (you do not need to add @pythnetwork/ as a prefix, it will be added automatically)"
          );
        },
      },
      {
        message: "Enter a brief, friendly description for your package",
        name: "description",
        type: "text",
      },
      {
        choices: (_, { packageType }: InProgressCreatePythAppResponses) =>
          getAvailableFolders()
            .map((val) => ({
              title: val,
              value: val,
            }))
            .filter(
              ({ value: relPath }) =>
                packageType !== PackageType.WEBAPP &&
                !relPath.startsWith("apps"),
            ),
        message: "Where do you want your package to live?",
        name: "folder",
        type: (_, { packageType }: InProgressCreatePythAppResponses) =>
          packageType === PackageType.WEBAPP ? false : "select",
      },
      {
        message:
          "Are you intending on publishing this, publicly on NPM, for users outside of our org to use?",
        name: "isPublic",
        type: "confirm",
      },
      {
        message: (
          _,
          {
            folder,
            packageName,
            packageType,
          }: InProgressCreatePythAppResponses,
        ) => {
          let msg = `Please confirm your choices:${os.EOL}`;
          msg += `Creating a ${chalk.magenta(packageType)} package, named ${chalk.magenta(packageName)}, in ${chalk.magenta(packageType === PackageType.WEBAPP ? "apps" : folder)}/${packageName?.split("/")[1] ?? ""}.${os.EOL}`;
          msg += "Look good?";

          return msg;
        },
        name: "confirm",
        type: "confirm",
      },
    ])) as CreatePythAppResponses;

  if (!confirm) {
    Logger.warn("oops, you did not confirm your choices.");
    return;
  }

  const [, packageNameWithoutOrg = ""] = packageName.split("/");

  const relDest =
    packageType === PackageType.WEBAPP
      ? path.join("apps", packageNameWithoutOrg)
      : folder;
  const absDest = path.join(
    appRootPath.toString(),
    relDest,
    packageNameWithoutOrg,
  );

  Logger.info("ensuring", relDest, "exists");
  await fs.ensureDir(absDest);

  Logger.info("copying files");
  const templateInputFolder = getTemplatesInputFolder(packageType);
  await fs.copy(templateInputFolder, absDest, { overwrite: true });

  const destFiles = await glob(path.join(absDest, "**", "*"), {
    absolute: true,
    dot: true,
    onlyFiles: true,
  });

  Logger.info(
    "updating files with the choices you made in the initial prompts",
  );
  await Promise.all(
    destFiles.map(async (fp) => {
      debugger;
      const contents = await fs.readFile(fp, "utf8");
      const updatedContents = renderTemplate(contents, {
        description,
        name: packageName,
        relativeFolder: relDest,
      });
      await fs.writeFile(fp, updatedContents, "utf8");

      if (fp.endsWith("package.json")) {
        const pjson = JSON.parse(updatedContents) as PackageJson;
        pjson.private = !isPublic;
        if (isPublic) {
          pjson.publishConfig = {
            access: "public",
          };
        }

        await fs.writeFile(fp, JSON.stringify(pjson, undefined, 2), "utf8");
      }
    }),
  );

  Logger.info("installing deps");
  execSync("pnpm i", { cwd: appRootPath.toString(), stdio: "inherit" });

  Logger.info(`Done! ${packageName} is ready for development`);
}

await createPythApp();
