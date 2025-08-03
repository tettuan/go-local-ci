/**
 * Information about a Go package
 */
export interface GoPackageInfo {
  readonly path: string;
  readonly name: string;
  readonly isTestPackage: boolean;
  readonly hasGoMod: boolean;
  readonly dependencies: string[];
}

/**
 * Go module information
 */
export interface GoModuleInfo {
  readonly path: string;
  readonly moduleName: string;
  readonly goVersion: string;
  readonly packages: GoPackageInfo[];
}
