/**
 * Stage execution result
 */
export interface StageResult {
  readonly stageName: string;
  readonly success: boolean;
  readonly duration: number;
  readonly output?: string;
  readonly error?: string;
  readonly failedPackages?: string[];
}

/**
 * Complete Go CI execution result
 */
export interface GoCIResult {
  readonly success: boolean;
  readonly duration: number;
  readonly stages: StageResult[];
  readonly totalPackages: number;
  readonly failedPackages: string[];
  readonly summary: string;
}
