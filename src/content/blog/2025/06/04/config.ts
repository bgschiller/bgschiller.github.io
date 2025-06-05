import type { PackageJson } from "./package-json";
import pluginBabel from "@rollup/plugin-babel";
import pluginCommonJS from "@rollup/plugin-commonjs";
import pluginJson from "@rollup/plugin-json";
import pluginNodeResolve from "@rollup/plugin-node-resolve";
import pluginReplace from "@rollup/plugin-replace";
import pluginTypeScript from "@rollup/plugin-typescript";
import { existsSync } from "node:fs";
import * as path from "node:path";
import type { OutputOptions, PreRenderedChunk, RollupOptions } from "rollup";
import optimizeConstEnum from "ts-transformer-optimize-const-enum";
import {
  type BuildOptions,
  getInferredBuildOptions,
} from "./getInferredBuildOptions";
import type { RollupExecutorOptions } from "./options";

export function createRollupOptions(
  workspaceDir: string,
  packageDir: string,
  packageJson: PackageJson,
  executorOptions: RollupExecutorOptions,
  buildOptions: BuildOptions = getInferredBuildOptions(packageDir, packageJson),
) {
  const inputs = Object.entries(buildOptions);

  const findTSConfig = (input: string) => {
    const name = path.basename(input).replace(/\.ts$/, "");
    const tsconfig = path.join(packageDir, `tsconfig.${name}.json`);
    if (existsSync(tsconfig)) return tsconfig;
    return path.join(packageDir, "tsconfig.json");
  };

  const outputDir = path.join(packageDir, "dist");
  const packageJsonPath = "package.json";

  return inputs.map(
    ([input, outputs]) =>
      ({
        cache: false,
        input: path.join(packageDir, input),
        plugins: [
          pluginJson(),
          pluginNodeResolve(),
          pluginTypeScript({
            tsconfig: findTSConfig(input),
            exclude: ["**/*.spec.ts", "**/*.spec.tsx"],

            outputToFilesystem: false,
            noEmitOnError: true,

            compilerOptions: {
              declaration: true,
              outDir: outputDir,
              declarationMap: true,
              sourceMap: true,
              rootDir: path.join(path.dirname(packageJsonPath), "src"),
              composite: false,
            },

            transformers: {
              before: [
                // This generates an optimized JavaScript equivalent of "const enum" which
                // is tree-shakeable.
                {
                  type: "program",
                  factory: optimizeConstEnum,
                },
              ],
              afterDeclarations: [
                // This rewrites "const enum" to "enum" for the generated declaration files.
                // So that it can be used in the consuming projects.
                {
                  type: "program",
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  factory: (program) => optimizeConstEnum(program) as any,
                },
              ],
            },
          }),

          ...(executorOptions.transformModernSyntax
            ? [
                pluginReplace({
                  preventAssignment: true,
                  values: {
                    // Replace env vars by something supported by Webpack for external bundlers.
                    // Webpack does not support import.meta.env, so replacing by process.env.NODE_ENV.
                    "import.meta.env.NODE_ENV": "process.env.NODE_ENV",
                    "import.meta.env.DEV":
                      'process.env.NODE_ENV === "dev" || process.env.NODE_ENV === "development"',
                  },
                }),
                pluginCommonJS(),
                pluginBabel({
                  babelrc: false,
                  extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
                  babelHelpers: "bundled",
                  presets: ["@babel/preset-env"].map((id) =>
                    require.resolve(id),
                  ),
                  cwd: packageDir,
                  generatorOpts: { importAttributesKeyword: "with" },
                }),
              ]
            : []),
        ],
        external: createExternalOption(packageJson, {
          warnOnExternal: executorOptions.transformModernSyntax ? false : true,
        }),
        treeshake: { preset: "recommended" },
        strictDeprecations: true,
        output: createOutputOptions(
          packageDir,
          packageJson,
          outputs,
          executorOptions,
        ),
      }) satisfies RollupOptions,
  );
}

function createExternalOption(
  packageJson: PackageJson,
  { warnOnExternal = true }: { readonly warnOnExternal?: boolean },
): (
  source: string,
  importer: string | undefined,
  isResolved: boolean,
) => boolean {
  const dependencies = new Set(
    Object.keys({
      ...packageJson.dependencies,
      ...packageJson.peerDependencies,
      ...packageJson.optionalDependencies,
    }),
  );
  if (packageJson.name) {
    dependencies.add(packageJson.name);
  }

  return (source, _, isResolved) => {
    if (isResolved) return false;
    if (source.startsWith(".")) return false;
    if (source.startsWith("node:")) return true;
    if (dependencies.has(source)) return true;
    const parts = source.split("/");
    if (parts.length === 0) return false;
    const packageName = parts
      .slice(0, source.startsWith("@") ? 2 : 1)
      .join("/");
    if (dependencies.has(packageName)) return true;

    if (warnOnExternal && isResolved && source.includes("node_modules")) {
      console.warn(
        `External dependency: ${source}. This is probably a mistake, make sure to add all dependencies to the package.json file.`,
      );
    }

    return false;
  };
}

function createOutputOptions(
  packageDir: string,
  packageJson: PackageJson,
  outputs: readonly {
    readonly type: "commonjs" | "esm" | "auto";
    readonly file?: string;
  }[],
  options: RollupExecutorOptions,
): OutputOptions[] {
  const format = packageJson.type === "module" ? "esm" : "commonjs";
  const sharedOutputOptions: Partial<OutputOptions> = {
    assetFileNames: `[name]-[hash].[ext]`,
    sourcemap: true,
    generatedCode: {
      preset: "es2015",
      constBindings: true,
      objectShorthand: true,
    },
    exports: "named",
  };

  if (options.preserveModules) {
    sharedOutputOptions.preserveModules = true;
    sharedOutputOptions.preserveModulesRoot = path.join(packageDir, "src");
  }

  const srcDir = path.join(packageDir, "src");

  return outputs
    .map((output) => ({
      file: output.file,
      format: output.type === "auto" ? format : output.type,
    }))
    .map(({ format }) => {
      const getFileName = (chunkInfo: PreRenderedChunk) => {
        const name = chunkInfo.name.replace(/\.[a-z]+$/, "");
        const ext = format === "commonjs" ? "cjs" : "mjs";
        if (chunkInfo.isEntry) {
          return `${name}.${ext}`;
        }

        if (
          chunkInfo.facadeModuleId &&
          /\.(ts|tsx)$/.test(chunkInfo.facadeModuleId)
        ) {
          // create chunk in similar directory structure as source
          const relativeModuleId = path.relative(
            srcDir,
            chunkInfo.facadeModuleId,
          );
          const moduleExt = path.extname(relativeModuleId);
          return `${relativeModuleId.slice(0, -moduleExt.length)}-[hash].${ext}`;
        }

        return `${name}-[hash].${ext}`;
      };

      return {
        ...sharedOutputOptions,
        format,
        dir: path.join(packageDir, "dist"),
        entryFileNames: getFileName,
        chunkFileNames: getFileName,
      };
    });
}
