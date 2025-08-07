// This file is auto-generated. Do not edit manually.
// The version is synchronized with deno.json.

/**
 * The current version of ci-go, synchronized with deno.json.
 * @module
 */
export const VERSION = '0.1.0';

/**
 * Returns the current version string.
 * @returns The version string
 */
export function getVersion(): string {
  return VERSION;
}

/**
 * Returns version information object.
 * @returns Object containing version details
 */
export function getVersionInfo(): {
  version: string;
  name: string;
  description: string;
} {
  return {
    version: VERSION,
    name: '@aidevtool/ci-go',
    description: 'A Go CI tool wrapper for efficient test execution with domain-driven design',
  };
}
