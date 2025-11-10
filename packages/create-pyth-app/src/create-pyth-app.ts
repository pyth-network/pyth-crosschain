// this rule is absolutely broken for the typings the prompts library
// provides, so we need to hard-disable it for all usages of prompts

import os from "node:os";
import path from "node:path";

import chalk from "chalk";
import fs from "fs-extra";
import prompts from "prompts";

import { getAvailableFolders } from "./get-available-folders.js";
import { Logger } from "./logger.js";
import type {
  CreatePythAppResponses,
  InProgressCreatePythAppResponses,
} from "./types.js";
import { CUSTOM_FOLDER_CHOICE, PACKAGE_PREFIX, PackageType } from "./types.js";

async function createPythApp() {
  const cwd = process.cwd();

  const {
    confirm,
    customFolderPath,
    description,
    folder,
    packageName,
    packageType,
  } = (await prompts([
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
        [
          {
            title: "** let me enter my own path **",
            value: CUSTOM_FOLDER_CHOICE,
          },
          ...getAvailableFolders().map((val) => ({
            title: val,
            value: val,
          })),
        ].filter(
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
        "Enter the relative path to the folder where you would like to create your package",
      name: "customFolderPath",
      type: (_, { folder }: InProgressCreatePythAppResponses) =>
        folder === CUSTOM_FOLDER_CHOICE ? "text" : false,
    },
    {
      message: (
        _,
        {
          customFolderPath,
          folder,
          packageName,
          packageType,
        }: InProgressCreatePythAppResponses,
      ) => {
        let msg = `Please confirm your choices:${os.EOL}`;
        msg += `Creating a ${chalk.magenta(packageType)} package, named ${chalk.magenta(packageName)}, in ${chalk.magenta(customFolderPath ?? folder)}.${os.EOL}`;
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

  const relDest = customFolderPath ?? folder;
  const absDest = path.join(cwd, relDest);

  Logger.info("ensuring", relDest, "exists");
  await fs.ensureDir(absDest);
}

await createPythApp();
