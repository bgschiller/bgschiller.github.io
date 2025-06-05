import { describe, expect, test } from "vitest";
import { getInferredBuildOptions, dedupe } from "./getInferredBuildOptions";
import type { PackageJson } from "./package-json";

describe(dedupe, () => {
  test("should dedupe values", () => {
    expect([1, 2, 3, 1, 2, 3].filter(dedupe())).toEqual([1, 2, 3]);
  });

  test("should dedupe values with a custom hash function", () => {
    expect(
      [{ a: 1 }, { a: 2 }, { a: 1 }, { a: 2 }].filter(
        dedupe((value) => value.a),
      ),
    ).toEqual([{ a: 1 }, { a: 2 }]);
  });
});

vi.mock("node:fs", () => ({
  default: { existsSync: () => true },
  existsSync: () => true,
}));

describe(getInferredBuildOptions, () => {
  test("creates commonjs build options from main field", () => {
    expect(
      getInferredBuildOptions("/virtual", { main: "dist/index.js" }),
    ).toEqual({
      "src/index.ts": [{ type: "commonjs", file: "dist/index.js" }],
    });

    expect(
      getInferredBuildOptions("/virtual", { main: "schema.json" }),
    ).toEqual({});
  });

  test("creates esm build options from module field", () => {
    expect(
      getInferredBuildOptions("/virtual", { module: "dist/index.js" }),
    ).toEqual({
      "src/index.ts": [{ type: "esm", file: "dist/index.js" }],
    });
  });

  test("from string exports field", () => {
    expect(
      getInferredBuildOptions("/virtual", { exports: "./dist/index.js" }),
    ).toEqual({
      "src/index.ts": [{ type: "auto", file: "dist/index.js" }],
    });
    expect(
      getInferredBuildOptions("/virtual", { exports: "./dist/index.cjs" }),
    ).toEqual({
      "src/index.ts": [{ type: "commonjs", file: "dist/index.cjs" }],
    });
    expect(
      getInferredBuildOptions("/virtual", { exports: "./dist/index.mjs" }),
    ).toEqual({
      "src/index.ts": [{ type: "esm", file: "dist/index.mjs" }],
    });
  });

  test("from array exports field", () => {
    const packageJson: PackageJson = {
      exports: ["./dist/index.js", "./dist/cli.js"],
    };

    expect(getInferredBuildOptions("/virtual", packageJson)).toEqual({
      "src/index.ts": [{ type: "auto", file: "dist/index.js" }],
      "src/cli.ts": [{ type: "auto", file: "dist/cli.js" }],
    });
  });

  test("from exports field aliases", () => {
    const packageJson: PackageJson = {
      exports: {
        ".": "./dist/index.js",
        "./cli": "./dist/out.js",
      },
    };

    expect(getInferredBuildOptions("/virtual", packageJson)).toEqual({
      "src/index.ts": [{ type: "auto", file: "dist/index.js" }],
      "src/cli.ts": [{ type: "auto", file: "dist/out.js" }],
    });
  });

  test("from exports field with sub-paths", () => {
    const packageJson: PackageJson = {
      exports: {
        ".": {
          import: "./dist/index.mjs",
          require: "./dist/index.cjs",
          default: "./dist/index.mjs",
        },
        "./cli": {
          import: "./dist/cli.mjs",
          require: "./dist/cli.cjs",
        },
      },
    };

    expect(getInferredBuildOptions("/virtual", packageJson)).toEqual({
      "src/index.ts": [
        { type: "esm", file: "dist/index.mjs" },
        { type: "commonjs", file: "dist/index.cjs" },
      ],
      "src/cli.ts": [
        { type: "esm", file: "dist/cli.mjs" },
        { type: "commonjs", file: "dist/cli.cjs" },
      ],
    });
  });

  test("from exports field with conditions", () => {
    const packageJson: PackageJson = {
      exports: {
        import: {
          ".": "./dist/index.js",
          "./cli": "./dist/cli.js",
        },
        require: {
          ".": "./dist/index.cjs",
          "./cli": "./dist/cli.cjs",
        },
      },
    };

    expect(getInferredBuildOptions("/virtual", packageJson)).toEqual({
      "src/index.ts": [
        { type: "esm", file: "dist/index.js" },
        { type: "commonjs", file: "dist/index.cjs" },
      ],
      "src/cli.ts": [
        { type: "esm", file: "dist/cli.js" },
        { type: "commonjs", file: "dist/cli.cjs" },
      ],
    });
  });
});
