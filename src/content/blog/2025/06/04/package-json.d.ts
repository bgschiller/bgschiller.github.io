/**
 * Type interface for package.json file content.
 * @packageDocumentation
 */

/**
 * Package.json file content.
 * @public
 * @remarks
 * See {@link https://docs.npmjs.com/files/package.json} for more information.
 * See {@link https://nodejs.org/api/packages.html#nodejs-packagejson-field-definitions} for node.js specific fields.
 */
export interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  keywords?: string[];
  homepage?: string;
  bugs?: string | { url?: string; email?: string };
  license?: string;
  author?: string | { name: string; email?: string; url?: string };
  contributors?:
    | string[]
    | Array<{ name: string; email?: string; url?: string }>;
  funding?:
    | string
    | { type: string; url: string }
    | Array<{ type: string; url: string }>;
  files?: string[];
  main?: string;
  browser?: string;
  module?: string;
  bin?: string | Record<string, string>;
  man?: string | string[];
  directories?: { lib?: string; bin?: string };
  repository?: string | { type: string; url: string; directory?: string };
  scripts?: Record<string, string>;
  config?: Record<string, unknown>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional: boolean }>;
  bundleDependencies?: string[];
  optionalDependencies?: Record<string, string>;
  /** only root package */
  overrides?: Record<string, unknown>;
  engines?: Record<string, string>;
  os?: string[];
  cpu?: string[];
  private?: boolean;
  publishConfig?: Record<string, string>;

  // TypeScript specific
  types?: string;
  typings?: string;
  typesVersions?: Record<string, Record<string, string>>;

  // Bundler specific
  sideEffects?: boolean | string[];

  // Node.js specific
  packageManager?: string;
  type?: "module" | "commonjs";
  imports?: unknown;
  exports?: string | string[] | SubPathExports | ConditionalExports;

  // Nx specific
  // Do we want to convert https://github.com/nrwl/nx/blob/master/packages/nx/schemas/nx-schema.json to TypeScript?
  // This seems like enough for now.
  nx?: {
    tags?: string[];
    generators?: Record<string, unknown>;
    targets?: { [key: string]: unknown };
    implicitDependencies?: string[];
    namedInputs?: { [key: string]: unknown };
    [key: string]: unknown;
  };

  coverageThresholds?: {
    functions?: number;
    statements?: number;
    branches?: number;
    lines?: number;
  };
}

type SubPathExportKey = "." | `./${string}`;

/**
 * Exports field value for sub-path exports.
 * @public
 */
export type SubPathExports = Partial<
  Record<SubPathExportKey, string | ConditionalExports>
>;

type ConditionalExportKey =
  | "node"
  | "node-addons"
  | "import"
  | "require"
  | "default"
  | "types"
  | "production"
  | "development"
  | "browser";

/**
 * Exports field value for conditional exports.
 * @public
 */
export type ConditionalExports = Partial<
  Record<ConditionalExportKey, string | Record<SubPathExportKey, string>>
>;
