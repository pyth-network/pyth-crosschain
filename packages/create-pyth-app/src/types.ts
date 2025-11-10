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
  packageName: string;
  packageType: PackageType;
};

export type InProgressCreatePythAppResponses = Partial<CreatePythAppResponses>;

export const PACKAGE_PREFIX = "@pythnetwork/";

export const CUSTOM_FOLDER_CHOICE = "__custom__";
