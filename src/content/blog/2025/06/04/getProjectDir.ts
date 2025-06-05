import {
  type ExecutorContext,
  type NxJsonConfiguration,
  readNxJson,
  type Tree,
} from "@nx/devkit";

import * as path from "node:path";
export function readNxLibsFolder(tree: Tree) {
  return getNxLibFolder({ nxJsonConfiguration: readNxJson(tree) ?? {} });
}

export function getNxLibFolder(context: {
  readonly nxJsonConfiguration?: NxJsonConfiguration;
}) {
  return context.nxJsonConfiguration?.workspaceLayout?.libsDir ?? "libs";
}

export function getProjectDir(
  context: Pick<
    ExecutorContext,
    "projectName" | "root" | "nxJsonConfiguration"
  >,
) {
  if (context.projectName === undefined) return null;
  return path.join(
    context.root,
    // convention: @grammarly/foo would be in /packages/foo directory.
    path.join(getNxLibFolder(context), path.basename(context.projectName)),
  );
}
