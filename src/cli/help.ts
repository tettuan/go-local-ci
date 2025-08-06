/**
 * CLI Help and Version Display
 */

import { HELP_TEXT, VERSION_INFO } from '../domains/application-control/cli-parser.ts';

/**
 * Display help information
 */
export function displayHelp(): void {
  console.log(HELP_TEXT);
}

/**
 * Display version information
 */
export function displayVersion(): void {
  console.log(`go-ci version ${VERSION_INFO}`);
}
