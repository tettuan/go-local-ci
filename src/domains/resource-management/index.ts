/**
 * Resource Management Domain
 * Exports all public interfaces and implementations
 */

export type {
  DirectoryHierarchy,
  DirectoryInfo,
  GoFileType,
  GoModuleInfo,
  GoPackageInfo,
  ModuleDependency,
  ModuleReplace,
  ProjectStructure,
  ScanOptions,
  ScanResult,
} from './types.ts';

export { FileFilter, MaxDepth } from './types.ts';

export { type FileSystem, GoProjectScanner } from './project-scanner.ts';
