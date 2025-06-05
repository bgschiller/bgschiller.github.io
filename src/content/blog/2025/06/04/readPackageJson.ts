import type { PackageJson } from "./package-json";
import * as assert from "node:assert";
import * as fsAsync from "node:fs/promises";
import * as fs from "node:fs";
import { basename } from "node:path";

export async function readPackageJson(
  packageJsonFile: string,
): Promise<PackageJson> {
  assert.ok(
    basename(packageJsonFile) === "package.json",
    "Expected package.json file",
  );
  return JSON.parse(await fsAsync.readFile(packageJsonFile, "utf-8"));
}

export function readPackageJsonSync(packageJsonFile: string): PackageJson {
  assert.ok(
    basename(packageJsonFile) === "package.json",
    "Expected package.json file",
  );
  return JSON.parse(fs.readFileSync(packageJsonFile, "utf-8"));
}
