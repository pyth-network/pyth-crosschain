/* eslint-disable tsdoc/syntax */
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
import { getTakenPorts } from "./get-taken-ports.js";
import { Logger } from "./logger.js";
import type {
  CreatePythAppResponses,
  InProgressCreatePythAppResponses,
} from "./types.js";
import { PACKAGE_PREFIX, PackageType, TEMPLATES_FOLDER } from "./types.js";

/**
 * Given either a raw name ("foo") or a scoped name ("@pythnetwork/foo"),
 * returns the normalized pair { raw, withOrg } where:
 * - raw is the unscoped package name ("foo")
 * - withOrg is the scoped package name ("@pythnetwork/foo")
 */
function normalizePackageNameInput(val: string | null | undefined = "") {
  // if the user passed a scoped name already, extract the part after `/`
  if (val?.startsWith("@")) {
    const parts = val.split("/");
    const raw = parts[1] ?? "";
    return {
      raw,
      withOrg: `${PACKAGE_PREFIX}${raw}`,
    };
  }
  // otherwise treat input as raw
  const raw = val ?? "";
  return {
    raw,
    withOrg: `${PACKAGE_PREFIX}${raw}`,
  };
}

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
  const takenServerPorts = getTakenPorts();

  const responses = (await prompts([
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
      // Store the raw name (no format). We'll normalize after prompts
      message: (_, responses: InProgressCreatePythAppResponses) =>
        `Enter the name for your ${responses.packageType ?? ""} package. ${chalk.magenta(PACKAGE_PREFIX)}`,
      name: "packageName",
      type: "text",
      validate: (name: string) => {
        // validate using the full scoped candidate so we ensure the raw name is valid
        const proposedName = `${PACKAGE_PREFIX}${name.replace(/^@.*\//, "")}`;
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
              packageType !== PackageType.WEBAPP && !relPath.startsWith("apps"),
          ),
      message: "Where do you want your package to live?",
      name: "folder",
      type: (_, { packageType }: InProgressCreatePythAppResponses) =>
        packageType === PackageType.WEBAPP ? false : "select",
    },
    {
      message:
        "On which port do you want your web application server to listen?",
      name: "serverPort",
      type: (_, { packageType }: InProgressCreatePythAppResponses) =>
        packageType === PackageType.WEBAPP ? "number" : false,
      validate: (port: number | string) => {
        const portStr = String(port);
        const taken = takenServerPorts.has(Number(port));
        const portHasFourDigits = portStr.length >= 4;
        if (taken) {
          return `${portStr} is already taken by another application. Please choose another port.`;
        }
        if (!portHasFourDigits) {
          return "please specify a port that has at least 4 digits";
        }
        return true;
      },
    },
    {
      message:
        "Are you intending on publishing this, publicly on NPM, for users outside of our org to use?",
      name: "isPublic",
      type: (_, { packageType }: InProgressCreatePythAppResponses) =>
        packageType === PackageType.WEBAPP ? false : "confirm",
    },
    {
      message: (
        _,
        { folder, packageName, packageType }: InProgressCreatePythAppResponses,
      ) => {
        // normalize for display
        const { raw: pkgRaw, withOrg: pkgWithOrg } =
          normalizePackageNameInput(packageName);

        let msg = `Please confirm your choices:${os.EOL}`;
        msg += `Creating a ${chalk.magenta(packageType)} package, named ${chalk.magenta(pkgWithOrg)}, in ${chalk.magenta(packageType === PackageType.WEBAPP ? "apps" : folder)}/${pkgRaw}.${os.EOL}`;
        msg += "Look good?";

        return msg;
      },
      name: "confirm",
      type: "confirm",
    },
  ])) as CreatePythAppResponses;

  const {
    confirm,
    description,
    folder,
    isPublic,
    packageName,
    packageType,
    serverPort,
  } = responses;

  if (!confirm) {
    Logger.warn("oops, you did not confirm your choices.");
    return;
  }

  // normalize package-name inputs to deterministic values
  const { raw: packageNameWithoutOrg, withOrg: packageNameWithOrg } =
    normalizePackageNameInput(packageName);

  const relDest =
    packageType === PackageType.WEBAPP
      ? path.join("apps", packageNameWithoutOrg)
      : path.join(folder, packageNameWithoutOrg);
  const absDest = path.join(appRootPath.toString(), relDest);

  Logger.info("ensuring", relDest, `exists (abs path: ${absDest})`);
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
    destFiles
      .filter((fp) => !fp.includes("node_module"))
      .map(async (fp) => {
        const contents = await fs.readFile(fp, "utf8");
        const updatedContents = renderTemplate(contents, {
          description,
          name: packageNameWithOrg,
          packageNameWithoutOrg,
          relativeFolder: relDest,
          serverPort,
        });
        await fs.writeFile(fp, updatedContents, "utf8");

        if (fp.endsWith("package.json")) {
          const pjson = JSON.parse(updatedContents) as PackageJson;
          // ensure package name in package.json is the scoped name
          pjson.name = packageNameWithOrg;
          pjson.private = !isPublic;
          if (isPublic) {
            pjson.publishConfig = {
              access: "public",
            };
          } else {
            // ensure publishConfig is removed if present and not public
            if (pjson.publishConfig) {
              delete pjson.publishConfig;
            }
          }

          await fs.writeFile(fp, JSON.stringify(pjson, undefined, 2), "utf8");
        }
      }),
  );

  Logger.info("installing deps");
  execSync("pnpm i", { cwd: appRootPath.toString(), stdio: "inherit" });

  Logger.info(`Done! ${packageNameWithOrg} is ready for development`);
  Logger.info("please checkout your package's README for more information:");
  Logger.info(`  ${path.join(relDest, "README.md")}`);
}

await createPythApp();
