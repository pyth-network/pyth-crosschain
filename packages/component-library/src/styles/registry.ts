import type { SimpleStyleRegistry } from "simplestyle-js";

let registryInstance: SimpleStyleRegistry | undefined;

export function setRegistryInstance(registry: SimpleStyleRegistry) {
  registryInstance = registry;
}

export function getRegistryInstance() {
  return registryInstance;
}