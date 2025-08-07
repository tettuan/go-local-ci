import { assertEquals } from '@std/assert';
import { main } from '../src/main.ts';

// Mock console and Deno.exit to capture output
let consoleOutput: string[] = [];
let exitCode: number | undefined;

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalDenoExit = Deno.exit;

function setupMocks() {
  consoleOutput = [];
  exitCode = undefined;
  
  console.log = (...args: unknown[]) => {
    consoleOutput.push(args.join(' '));
  };
  
  console.error = (...args: unknown[]) => {
    consoleOutput.push('[ERROR] ' + args.join(' '));
  };
  
  console.warn = (...args: unknown[]) => {
    consoleOutput.push('[WARN] ' + args.join(' '));
  };
  
  Deno.exit = (code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`Process.exit(${code ?? 0})`);
  };
}

function restoreMocks() {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  Deno.exit = originalDenoExit;
}

Deno.test('Main - processes simple Go project successfully', async () => {
  setupMocks();
  
  try {
    const simpleProjectPath = './tests/fixtures/simple-go-project';
    const args = [
      '--working-directory', simpleProjectPath,
      '--mode', 'single-package',
    ];
    
    await main(args);
  } catch (e) {
    // Expected: Deno.exit will throw
    if (e instanceof Error && !e.message.startsWith('Process.exit')) {
      throw e;
    }
  } finally {
    // Don't restore here, do it after checking
  }
  
  restoreMocks();
  
  // Check that tests passed
  const hasSuccess = consoleOutput.some(line => line.includes('✅'));
  assertEquals(hasSuccess, true);
  assertEquals(exitCode, 0);
});

Deno.test('Main - handles help flag', async () => {
  setupMocks();
  
  try {
    await main(['--help']);
  } catch (e) {
    // Expected: Deno.exit will throw
    if (e instanceof Error && !e.message.startsWith('Process.exit')) {
      throw e;
    }
  } finally {
    restoreMocks();
  }
  
  // Check that help was displayed
  const hasHelp = consoleOutput.some(line => 
    line.includes('Go CI') || line.includes('Usage:')
  );
  assertEquals(hasHelp, true);
  assertEquals(exitCode, 0);
});

Deno.test('Main - handles version flag', async () => {
  setupMocks();
  
  try {
    await main(['--version']);
  } catch (e) {
    // Expected: Deno.exit will throw
    if (e instanceof Error && !e.message.startsWith('Process.exit')) {
      throw e;
    }
  } finally {
    restoreMocks();
  }
  
  // Check that version was displayed
  const hasVersion = consoleOutput.some(line => 
    line.includes('version') || line.includes('v')
  );
  assertEquals(hasVersion, true);
  assertEquals(exitCode, 0);
});

Deno.test('Main - handles errors gracefully', async () => {
  setupMocks();
  
  try {
    // Non-existent directory should cause an error
    const args = [
      '--working-directory', '/non/existent/directory',
      '--mode', 'all',
    ];
    
    await main(args);
  } catch (e) {
    // Expected: Deno.exit will throw
    if (e instanceof Error && !e.message.startsWith('Process.exit')) {
      throw e;
    }
  } finally {
    restoreMocks();
  }
  
  // Check that error was reported
  const hasError = consoleOutput.some(line => 
    line.includes('[ERROR]') || line.includes('❌')
  );
  assertEquals(hasError, true);
  assertEquals(exitCode, 1);
});