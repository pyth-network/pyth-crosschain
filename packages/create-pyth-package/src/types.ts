import path from "node:path";

export enum PackageType {
  CLI = "Command-line application",
  LIBRARY = "JavaScript / TypeScript Library",
  WEBAPP = "Web Application",
}

export type CreatePythAppResponses = {
  confirm: boolean;
  customFolderPath?: string;
  description: string;
  folder: string;
  isPublic: boolean;
  packageName: string;
  packageType: PackageType;
  serverPort?: number;
};

export type InProgressCreatePythAppResponses = Partial<CreatePythAppResponses>;

export const PACKAGE_PREFIX = "@pythnetwork/";

export const CUSTOM_FOLDER_CHOICE = "__custom__";

export const TEMPLATES_FOLDER = path.join(import.meta.dirname, "templates");
