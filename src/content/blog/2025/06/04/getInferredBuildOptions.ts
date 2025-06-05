import type {
  ConditionalExports,
  PackageJson,
  SubPathExports,
} from "./package-json";
import * as assert from "node:assert";
import * as path from "node:path/posix";
import { existsSync } from "node:fs";

export function dedupe<T>(
  computeHash: (value: T) => unknown = (value) => value,
): (value: T) => boolean {
  const seen = new Set();
  return (value) => {
    const hash = computeHash(value);
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  };
}

export function getInferredBuildOptions(
  packageDir: string,
  packageJson: PackageJson,
): BuildOptions {
  const packageJsonFile = path.resolve(packageDir, "package.json");
  const srcDir = path.relative(packageDir, path.dirname(packageJsonFile));

  const options =
    packageJson.exports !== undefined
      ? getBuildOptionsFromExports(packageJson.exports)
      : mergeBuildOptions(
          getBuildOptionsFromMainField(packageJson),
          getBuildOptionsFromModuleField(packageJson),
        );

  return Object.fromEntries(
    Object.entries(options)
      .map(
        ([entryPoint, outputs]) =>
          [
            path.join(srcDir, entryPoint),
            outputs.map((output) => ({
              ...output,
              file: output.file ? path.join(srcDir, output.file) : undefined,
            })),
          ] as const,
      )
      .filter(([entryPoint]) => existsSync(path.join(packageDir, entryPoint))),
  );
}

export type BuildOptions = Record<
  string,
  Array<{ readonly type: "commonjs" | "esm" | "auto"; readonly file?: string }>
>;

function getBuildOptionsFromMainField(packageJson: PackageJson): BuildOptions {
  const entry = packageJson.publishConfig?.["main"] ?? packageJson.main;
  if (entry === undefined) return {};
  return getBuildOptionsFromFile(entry, ".", "commonjs");
}
function getBuildOptionsFromModuleField(
  packageJson: PackageJson,
): BuildOptions {
  const entry = packageJson.publishConfig?.["module"] ?? packageJson.module;
  if (entry === undefined) return {};
  return getBuildOptionsFromFile(entry, ".", "esm");
}
function getBuildOptionsFromExports(
  exports: Required<PackageJson>["exports"],
): BuildOptions {
  if (typeof exports === "string") {
    return getBuildOptionsFromFile(exports);
  }

  if (Array.isArray(exports)) {
    return exports.reduce(
      (config, outputFileName) =>
        mergeBuildOptions(config, getBuildOptionsFromFile(outputFileName)),
      {},
    );
  }

  if (Object.keys(exports).some((key) => key.startsWith("."))) {
    return getBuildOptionsFromSubPathExports(exports as SubPathExports);
  }

  return getBuildOptionsFromConditionalExports(exports as ConditionalExports);
}

function getBuildOptionsFromFile(
  output: string,
  input?: string,
  type?: "commonjs" | "esm" | "auto",
): BuildOptions {
  if (!isJavaScriptModule(output)) return {};

  const filenameWithoutExtension =
    (input === "." ? "index" : input) ??
    path.basename(output, path.extname(output));

  const fileName = path.join("src", filenameWithoutExtension + ".ts");
  const inferredType = output.endsWith(".cjs")
    ? "commonjs"
    : output.endsWith(".mjs")
      ? "esm"
      : "auto";

  return {
    [fileName]: [
      {
        type: inferredType === "auto" ? type ?? "auto" : inferredType,
        file: output,
      },
    ],
  };
}
function getBuildOptionsFromSubPathExports(
  exports: SubPathExports,
  condition?: keyof ConditionalExports,
): BuildOptions {
  const format = condition ? getBuildTypeFromCondition(condition) : undefined;

  return Object.entries(exports)
    .map(([subPath, value]) => {
      assert.ok(value !== undefined, "Expected value in sub-path export");

      if (typeof value === "string") {
        return getBuildOptionsFromFile(value, subPath, format);
      }

      assert.ok(
        condition === undefined,
        "Nested conditional exports are not supported.",
      );

      return getBuildOptionsFromConditionalExports(value, subPath);
    })
    .reduce((config, entry) => mergeBuildOptions(config, entry), {});
}
function getBuildOptionsFromConditionalExports(
  exports: ConditionalExports,
  subPath?: string,
): BuildOptions {
  return (
    Object.entries(exports) as [
      keyof ConditionalExports,
      ConditionalExports[keyof ConditionalExports],
    ][]
  )
    .map(([condition, value]) => {
      const type = getBuildTypeFromCondition(condition);
      assert.ok(value !== undefined, "Expected value in conditional export");

      if (typeof value === "string") {
        return getBuildOptionsFromFile(value, subPath, type);
      }

      assert.ok(
        subPath === undefined,
        "Nested sub-path exports are not supported.",
      );

      return getBuildOptionsFromSubPathExports(value, condition);
    })
    .reduce((config, entry) => mergeBuildOptions(config, entry), {});
}
function getBuildTypeFromCondition(
  key: keyof ConditionalExports,
): "commonjs" | "esm" | "auto" {
  switch (key) {
    case "import":
      return "esm";
    case "require":
      return "commonjs";
    default:
      return "auto";
  }
}
function mergeBuildOptions(a: BuildOptions, b: BuildOptions): BuildOptions {
  const combined = { ...a };

  for (const [entryPoint, outputs] of Object.entries(b)) {
    const entryPointConfig = combined[entryPoint];
    if (entryPointConfig === undefined) {
      combined[entryPoint] = outputs;
    } else {
      entryPointConfig.push(...outputs);
    }
  }

  const filter = dedupe(
    (output: BuildOptions[string][number]) =>
      `${output.file ?? ""}:${output.type}`,
  );

  return Object.fromEntries(
    Object.entries(combined)
      .map(
        ([entryPoint, outputs]) =>
          [entryPoint, outputs.filter(filter)] as const,
      )
      .filter(([, outputs]) => outputs.length > 0),
  );
}
function isJavaScriptModule(file: string): boolean {
  return /\.(mjs|cjs|js)$/.test(file);
}
