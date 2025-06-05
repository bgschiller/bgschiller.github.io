export interface RollupExecutorOptions {
  readonly clean: boolean;
  readonly buildType: "release" | "debug";
  readonly preserveModules?: boolean;
  readonly transformModernSyntax?: boolean;
}
