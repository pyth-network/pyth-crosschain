// biome-ignore-all lint/style/noProcessEnv: test file manipulates env vars

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readMnemonic } from "../src/utils.js";

describe("readMnemonic", () => {
  let tmpDir: string;
  const originalMnemonic = process.env.MNEMONIC;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "price-pusher-test-"));
    delete process.env.MNEMONIC;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    if (originalMnemonic === undefined) {
      delete process.env.MNEMONIC;
    } else {
      process.env.MNEMONIC = originalMnemonic;
    }
  });

  it("reads mnemonic from file when path supplied", () => {
    const path = join(tmpDir, "mnemonic");
    writeFileSync(path, "from file mnemonic\n");
    expect(readMnemonic(path)).toBe("from file mnemonic");
  });

  it("falls back to MNEMONIC env var when no file path supplied", () => {
    process.env.MNEMONIC = "from env mnemonic";
    expect(readMnemonic(undefined)).toBe("from env mnemonic");
  });

  it("treats empty-string file path as not supplied", () => {
    process.env.MNEMONIC = "from env mnemonic";
    expect(readMnemonic("")).toBe("from env mnemonic");
  });

  it("file source takes precedence over env var", () => {
    const path = join(tmpDir, "mnemonic");
    writeFileSync(path, "from file\n");
    process.env.MNEMONIC = "from env";
    expect(readMnemonic(path)).toBe("from file");
  });

  it("throws when neither file nor env var supplied", () => {
    expect(() => readMnemonic(undefined)).toThrow(
      /No mnemonic provided/,
    );
  });

  it("throws when env var is empty string", () => {
    process.env.MNEMONIC = "";
    expect(() => readMnemonic(undefined)).toThrow(
      /No mnemonic provided/,
    );
  });
});
