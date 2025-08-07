# @tettuan/go-local-ci

[![JSR](https://jsr.io/badges/@tettuan/go-local-ci)](https://jsr.io/@tettuan/go-local-ci) [![GitHub](https://img.shields.io/github/license/tettuan/go-local-ci)](https://github.com/tettuan/go-local-ci/blob/main/LICENSE) [![Tests](https://github.com/tettuan/go-local-ci/actions/workflows/ci.yml/badge.svg)](https://github.com/tettuan/go-local-ci/actions/workflows/ci.yml)

A comprehensive Deno-based CI runner for Go projects with robust testing, formatting, linting, and build capabilities. Built with Domain-Driven Design principles and strong type safety for modern Go development workflows.

## ✨ Features

- 🔄 **Complete Go CI Pipeline**: Build → Test → Vet → Format → Lint
- 🎯 **Multiple Execution Modes**: Single-package, batch, and all modes for different project needs
- 🛡️ **Type Safety**: Full TypeScript support with strict type checking
- 📊 **Comprehensive Reporting**: Detailed error reporting and diagnostics with structured logging
- ⚙️ **Flexible Configuration**: Customizable batch sizes, log modes, and execution options
- 🔧 **Error Handling**: Structured error categorization and intelligent fallback mechanisms
- 📝 **Rich Logging**: Multiple log levels with debug, silent modes, and BreakdownLogger integration
- ⚡ **Performance Optimized**: Memory-efficient processing for large Go codebases
- 🏗️ **Domain-Driven Design**: Clean architecture with separated concerns and modular components
- 🐹 **Go-Specific**: Tailored for Go projects with go modules, workspaces, and testing conventions

## 🚀 Installation

### Using JSR (Recommended)

```bash
# Run directly without installation
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci

# Or add to your project
deno add @tettuan/go-local-ci
```

### Using GitHub

```bash
deno run --allow-read --allow-write --allow-run --allow-env \
  https://raw.githubusercontent.com/tettuan/go-local-ci/main/mod.ts
```

## 📖 Usage

### Command Line Interface (Main Use Case)

@aidevtool/ci-go is primarily designed as a CLI tool. Run the following commands in your Go project's root directory:

#### Basic Usage

```bash
# Run with default settings (all-packages mode - fastest)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci
```

#### Execution Mode Examples

```bash
# All mode: fastest execution (default)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode all

# Batch mode: balanced performance and safety
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode batch --batch-size 5

# Single-package mode: safest with detailed error reporting
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode single-package
```

#### Log Level Examples

```bash
# Normal mode: standard output
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --log-mode normal

# Silent mode: minimal output (optimal for CI/CD environments)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --log-mode silent

# Error-files-only mode: optimal for error identification
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --log-mode error-files-only

# Debug mode: detailed logs with BreakdownLogger integration
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --log-mode debug --log-key GO_CI_DEBUG --log-length M
```

#### Directory-Specific Execution

You can target specific directory hierarchies for CI execution:

```bash
# Execute only specific package (positional argument)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  ./cmd/myapp

# Execute only internal packages (--hierarchy option)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --hierarchy ./internal/

# Execute only service layer
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  ./pkg/service/

# Combine hierarchy and mode (execute cmd/ in batch mode)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --hierarchy ./cmd/ --mode batch

# Combine hierarchy and log mode (execute pkg/ in debug mode)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  ./pkg/ --log-mode error-files-only
```

#### Advanced Usage Examples

```bash
# Disable fallback and force batch mode
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode batch --no-fallback

# Execute only integration tests
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --test-filter "*integration*"

# Stop on first error
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --stop-on-first-error

# Specify working directory
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --cwd /path/to/go-project

# Enable verbose output for Go commands
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --verbose
```

### Programmatic Usage (Advanced)

For direct programmatic usage (advanced use cases):

```typescript
import { GoCI, GoCILogger, CLIParser, LogModeFactory, main } from "@tettuan/go-local-ci";

// Simple usage - run CI with default settings
await main(["--mode", "batch"]);

// Advanced usage - full control over CI configuration
const parseResult = CLIParser.parseArgs(["--mode", "single-package", "--log-mode", "debug"]);
if (parseResult.ok) {
  const configResult = CLIParser.buildGoCIConfig(parseResult.data);
  if (configResult.ok) {
    const config = configResult.data;
    const logMode = config.logMode || LogModeFactory.normal();
    const loggerResult = GoCILogger.create(logMode, config.breakdownLoggerConfig);

    if (loggerResult.ok) {
      const logger = loggerResult.data;
      const runnerResult = await GoCI.create(logger, config, Deno.cwd());

      if (runnerResult.ok) {
        const runner = runnerResult.data;
        const result = await runner.run();
        console.log(result.success ? "✅ Go CI passed" : "❌ Go CI failed");
      }
    }
  }
}
```

### Using Individual Components

```typescript
import {
  GoCILogger,
  FileSystemService,
  LogModeFactory,
  ProcessRunner,
  GoProjectDiscovery,
} from "@tettuan/go-local-ci";

// Use logger with different modes
const debugMode = LogModeFactory.debug();
const loggerResult = GoCILogger.create(debugMode);
if (loggerResult.ok) {
  const logger = loggerResult.data;
  logger.logInfo("Starting custom Go CI process");
}

// Use process runner for Go command execution
const processRunner = new ProcessRunner();
const result = await processRunner.run("go", ["test", "./..."]);
console.log(`Go test result: ${result.success}`);

// Use file system utilities
const fileSystem = new FileSystemService();
const discovery = new GoProjectDiscovery(fileSystem);
const goModules = await discovery.discoverGoModules("./");
console.log(`Found ${goModules.length} Go modules`);
```

## 🔧 Command Line Options

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `--mode <mode>` | Execution mode: all, batch, single-package (speed order) | all | `--mode batch` |
| `--hierarchy <path>` | Target directory hierarchy (execute specific directory only) | Entire project | `--hierarchy ./cmd/` |
| `--dir <path>` | Alias for hierarchy specification (same as --hierarchy) | Entire project | `--dir ./pkg/` |
| `<path>` | Positional argument for hierarchy (direct path without option) | Entire project | `./internal/service/` |
| `--batch-size <size>` | Number of packages per batch (1-50) | 10 | `--batch-size 5` |
| `--fallback` | Enable execution strategy fallback | true | `--fallback` |
| `--no-fallback` | Disable execution strategy fallback | - | `--no-fallback` |
| `--log-mode <mode>` | Log mode: normal, silent, debug, error-files-only | normal | `--log-mode debug` |
| `--log-key <key>` | BreakdownLogger key (required for debug mode) | - | `--log-key GO_CI_DEBUG` |
| `--log-length <length>` | BreakdownLogger length: W, M, L (required for debug) | - | `--log-length M` |
| `--stop-on-first-error` | Stop execution on first error | false | `--stop-on-first-error` |
| `--continue-on-error` | Continue execution after errors | true | `--continue-on-error` |
| `--test-filter <pattern>` | Filter test packages by pattern | - | `--test-filter "*integration*"` |
| `--cwd <path>` | Specify working directory | Current directory | `--cwd /path/to/project` |
| `--working-directory <path>` | Specify working directory (alias for --cwd) | Current directory | `--working-directory ./myproject` |
| `--verbose` | Enable verbose output for Go commands | false | `--verbose` |
| `--help, -h` | Display help message | - | `--help` |
| `--version, -v` | Display version information | - | `--version` |

### Option Combination Examples

```bash
# Fast execution (for CI/CD environments)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode all --log-mode silent

# Detailed debugging in development environment
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode single-package --log-mode debug --log-key DEV --log-length L

# Balanced settings for medium-sized projects
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode batch --batch-size 8 --log-mode error-files-only

# Execute specific tests only (integration tests)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --test-filter "*integration*" --stop-on-first-error

# Verbose Go output with normal logging
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --verbose --log-mode normal
```

## 🎯 Go CI Pipeline Stages

The Go CI runner executes the following stages in order:

1. **Go Module Check** - Validates go.mod and go.sum files
2. **Build Check** - Compiles all packages to verify buildability
3. **Test Execution** - Runs all tests with proper isolation and coverage
4. **Go Vet** - Validates code for suspicious constructs and potential bugs
5. **Go Format Check** - Ensures consistent code formatting with gofmt
6. **Go Lint** - Static analysis for code quality (if golangci-lint is available)

Each stage must pass before proceeding to the next. On failure, the pipeline stops and reports detailed error information.

## 🗂️ Directory Hierarchy Targeting

Efficient development for large Go projects is possible by targeting specific directory hierarchies for CI execution.

### Basic Usage of Hierarchy Specification

```bash
# Hierarchy specification with positional argument (recommended)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  ./cmd/

# Hierarchy specification with --hierarchy option
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --hierarchy ./pkg/

# --dir option (alias for --hierarchy)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --dir ./internal/
```

### Behavior When Hierarchy is Specified

#### ✅ Stages That Will Execute

1. **Go Module Check**: Validates go.mod files within specified hierarchy
2. **Build**: `go build <hierarchy>/...` - Build packages within specified hierarchy
3. **Test**: `go test <hierarchy>/...` - Execute only tests within specified hierarchy
4. **Vet**: `go vet <hierarchy>/...` - Vet packages within specified hierarchy
5. **Format**: `gofmt -l <hierarchy>/` - Format check files within specified hierarchy
6. **Lint**: `golangci-lint run <hierarchy>/...` - Lint packages within specified hierarchy

#### 🎯 Target Files (When Hierarchy is Specified)

- **Go source files**: `<hierarchy>/**/*.go`
- **Test files**: `<hierarchy>/**/*_test.go`
- **Go modules**: `<hierarchy>/**/go.mod`

### Practical Hierarchy Specification Examples

```bash
# Check command-line applications only
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  ./cmd/

# Check internal packages only
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  ./internal/

# Check specific service layer only
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  ./pkg/service/

# Check API handlers only
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  ./api/handlers/

# Check shared utilities only
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  ./pkg/utils/
```

## 📊 Execution Mode Details

### All Mode (`--mode all`) - Default

- Execute all packages at once
- Fastest execution but limited error isolation
- Optimal for simple projects or final validation
- Falls back to batch mode on failure
- Recommended use: Fast checks, small projects, CI/CD environments

```bash
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode all
```

### Batch Mode (`--mode batch`)

- Process packages in groups with configurable batch size
- Balance between performance and error isolation
- Automatically falls back to single-package mode on batch failure
- Optimal for most Go projects
- Recommended use: Medium to large projects, balanced approach

```bash
# Default batch size (10 packages)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode batch

# Custom batch size
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode batch --batch-size 5
```

### Single-Package Mode (`--mode single-package`)

- Execute packages one by one
- Maximum isolation and detailed error reporting
- Optimal for debugging specific package failures
- Slower execution but most reliable
- Recommended use: Development environment, debugging, detailed error investigation

```bash
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode single-package
```

## 🔍 Log Mode Details

### Normal Mode (`--log-mode normal`) - Default

- Standard output and progress display
- Stage completion notifications
- Error summary and package lists
- Recommended use: Interactive development environment

```bash
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --log-mode normal
```

### Silent Mode (`--log-mode silent`)

- Minimal output
- Only critical errors and final results
- Recommended use: CI/CD environments, automation scripts

```bash
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --log-mode silent
```

### Error Files Only Mode (`--log-mode error-files-only`)

- Display only packages containing errors
- Compact error reporting
- Optimal for rapid issue identification
- Recommended use: Quick error identification, code review

```bash
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --log-mode error-files-only
```

### Debug Mode (`--log-mode debug`)

- Detailed execution information with timestamps
- BreakdownLogger integration (requires `--log-key` and `--log-length`)
- Complete configuration and state information logging
- Recommended use: Troubleshooting, detailed analysis

```bash
# Detailed debugging with BreakdownLogger integration
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --log-mode debug --log-key GO_CI_DEBUG --log-length M

# Debug with short messages
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --log-mode debug --log-key DEV --log-length W

# Detailed debug with long messages
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --log-mode debug --log-key ANALYSIS --log-length L
```

## 🌍 Environment Variables

The following environment variables can be used during CI execution:

```bash
# Enable debug logging (alternative to --log-mode debug)
export DEBUG=true
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci

# Set log level
export LOG_LEVEL=debug
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci

# BreakdownLogger environment variables (when using debug mode)
export GO_CI_LOCAL_KEY=MY_DEBUG_KEY
export GO_CI_LOCAL_LENGTH=M
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --log-mode debug --log-key GO_CI_LOCAL --log-length M

# Go-specific environment variables
export GOOS=linux
export GOARCH=amd64
export CGO_ENABLED=0
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci
```

## ⚡ Practical Usage Patterns

### Development Workflow

```bash
# 1. Quick check during development
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode single-package --log-mode error-files-only

# 2. Complete check before commit
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode batch

# 3. Final verification before pull request
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode all --log-mode silent
```

### Development Workflow with Hierarchy Targeting

```bash
# 1. Quick check on working package only (cmd/myapp/ directory)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  ./cmd/myapp/ --mode single-package --log-mode error-files-only

# 2. Batch check API-related packages only (api/ directory)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  ./api/ --mode batch --log-mode normal

# 3. Execute internal package tests only (internal/ directory)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  ./internal/ --mode all

# 4. Check library changes impact (pkg/ directory)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  ./pkg/ --mode batch --stop-on-first-error

# 5. Verify utility modifications (pkg/utils/ directory)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  ./pkg/utils/ --mode all --log-mode silent
```

### CI/CD Environment

```bash
# Usage in GitHub Actions etc.
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode batch --log-mode silent --no-fallback

# Usage in Jenkins etc. (detailed logging)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode batch --log-mode normal

# Usage in Docker environment
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode all --log-mode silent
```

### Debug & Troubleshooting

```bash
# Detailed investigation of specific issues
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode single-package --log-mode debug --log-key ISSUE_123 --log-length L

# Debug only tests matching specific pattern
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --test-filter "*api*" --log-mode debug --log-key API_TEST --log-length M

# Stop immediately after error for debugging
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --stop-on-first-error --log-mode debug --log-key FIRST_ERROR --log-length L
```

## 🏗️ Architecture

The Go CI runner follows Domain-Driven Design principles with clear separation of concerns:

### Core Components

- `GoCI` - Main orchestration class managing the complete Go CI pipeline
- `GoCIPipelineOrchestrator` - Manages stage execution flow and dependencies
- `GoCILogger` - Structured logging with multiple modes and BreakdownLogger integration
- `ProcessRunner` - Async process execution with timeout and error handling
- `FileSystemService` - File discovery and path utilities with Go-specific classification
- `CLIParser` - Command-line argument parsing and validation

### Domain Services

- `ExecutionStrategyService` - Determines optimal execution strategies for Go projects
- `ErrorClassificationService` - Categorizes and analyzes Go CI errors for appropriate handling
- `StageInternalFallbackService` - Implements intelligent fallback logic between execution modes
- `GoPackageClassificationService` - Classifies Go packages by type and purpose

### Infrastructure Layer

- `GoCommandRunner` - Go-specific command execution and environment management
- `GoProjectDiscovery` - Discovers and categorizes Go packages across directories
- `BreakdownLoggerEnvConfig` - Configuration management for enhanced debugging

## ⚡ Performance Features

### Intelligent Batching

- **Configurable Batch Sizes**: Optimize for your system resources (1-50 packages per batch)
- **Memory Efficiency**: Processes large Go codebases without memory exhaustion
- **Resource Detection**: Automatically adjusts batch sizes based on system capabilities

### Fallback Mechanisms

- **Automatic Fallback**: Seamlessly falls back from batch to single-package mode on failures
- **Error-Specific Handling**: Different fallback strategies based on Go error types
- **Progressive Degradation**: Maintains functionality even when optimal strategies fail

### Real-time Feedback

- **Live Progress Reporting**: See CI progress as it happens
- **Immediate Error Feedback**: Get error details as soon as they're detected
- **Stage-by-Stage Results**: Clear visibility into each pipeline stage

## 🛡️ Error Handling

### Error Classification

- **Build Errors**: Go compilation and dependency issues
- **Test Failures**: Runtime test failures with detailed stack traces
- **Vet Issues**: Code quality and potential bug detection
- **Format Violations**: Code formatting inconsistencies
- **Lint Violations**: Static analysis and code quality issues

### Fallback Strategies

```
// Automatic fallback flow
All Mode → Batch Mode → Single-Package Mode → Detailed Error Report
```

### Error Reporting

- Structured error messages with Go-specific context
- Package-specific error isolation
- Aggregated error summaries
- Actionable recommendations for fixes

## 🧪 Testing & Quality

This package includes comprehensive test coverage:

- **Unit Tests** for individual components and services
- **Integration Tests** for complete Go CI pipeline flows
- **Type Safety Tests** ensuring robust TypeScript integration
- **Error Scenario Tests** validating fallback mechanisms
- **Go Project Tests** with real Go code examples

Run tests locally:

```bash
deno test --allow-read --allow-write --allow-run --allow-env
```

## 📋 Development Workflow

### Local Development

```bash
# Clone the repository
git clone https://github.com/tettuan/go-local-ci.git
cd go-local-ci

# Run CI on the project itself
deno task ci

# Run tests
deno task test

# Format code
deno task fmt

# Lint code
deno task lint

# Type check
deno task check
```

### Available Tasks

| Task | Command | Description |
|------|---------|-------------|
| `ci` | `deno task ci` | Run full CI pipeline |
| `ci-debug` | `deno task ci-debug` | Run CI with debug logging |
| `ci-silent` | `deno task ci-silent` | Run CI in silent mode |
| `ci-batch` | `deno task ci-batch` | Run CI in batch mode |
| `ci-all` | `deno task ci-all` | Run CI in all mode |
| `test` | `deno task test` | Run test suite |
| `fmt` | `deno task fmt` | Format code |
| `lint` | `deno task lint` | Lint code |
| `check` | `deno task check` | Type check |

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with comprehensive tests
4. Run the CI pipeline: `deno task ci`
5. Commit your changes: `git commit -am 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Submit a pull request

### Development Guidelines

- Maintain strong TypeScript typing
- Follow Domain-Driven Design principles
- Add comprehensive test coverage
- Update documentation for new features
- Ensure all CI stages pass
- Test with real Go projects

## 📄 License

MIT License - see the [LICENSE](https://github.com/tettuan/go-local-ci/blob/main/LICENSE) file for details.

## 🔗 Links

- [JSR Package](https://jsr.io/@tettuan/go-local-ci) - Official package registry
- [GitHub Repository](https://github.com/tettuan/go-local-ci) - Source code and issues
- [Documentation](https://jsr.io/@tettuan/go-local-ci/doc) - API documentation
- [Issues](https://github.com/tettuan/go-local-ci/issues) - Bug reports and feature requests
- [Releases](https://github.com/tettuan/go-local-ci/releases) - Version history and changelogs

Built with ❤️ for the Go community

## Related Projects

- [@aidevtool/ci](https://jsr.io/@aidevtool/ci) - CI runner for Deno/TypeScript projects
- [Go Official Tools](https://golang.org/doc/cmd) - Official Go command line tools
- [golangci-lint](https://golangci-lint.run/) - Fast linters runner for Go
