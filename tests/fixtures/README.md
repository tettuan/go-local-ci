# Test Fixtures

This directory contains Go project fixtures used for testing the Go CI tool.

## Structure

### `simple-go-project/`
A basic Go project with:
- Single `main.go` file with simple functions
- Comprehensive test coverage
- Proper formatting and no issues
- Used for testing successful CI runs

### `multi-package-project/`
A more complex Go project with:
- Multiple packages (`pkg/math/`, `cmd/calculator/`)
- Internal dependencies between packages
- Proper Go module structure
- Used for testing multi-package scenarios and hierarchy targeting

### `problematic-go-project/`
A Go project with intentional issues:
- Formatting problems (missing indentation, spacing)
- Go vet warnings (unused variables)
- Failing tests (wrong expected values)
- Used for testing error handling and failure scenarios

## Usage in Tests

These fixtures are used by the integration tests to verify that the Go CI tool:

1. **Correctly processes well-formed projects**
2. **Handles multi-package projects with dependencies**
3. **Properly detects and reports issues in problematic projects**
4. **Supports hierarchy targeting for specific packages**
5. **Works across different execution modes (all, batch, single-package)**

## Maintenance

When adding new test scenarios:

1. Create a new directory under `tests/fixtures/`
2. Add a representative Go project structure
3. Update the integration tests to use the new fixture
4. Document the fixture purpose in this README

## Examples

```bash
# Test with simple project
deno run --allow-read --allow-write --allow-run --allow-env ./mod.ts \
  --cwd ./tests/fixtures/simple-go-project --log-mode silent

# Test with multi-package project
deno run --allow-read --allow-write --allow-run --allow-env ./mod.ts \
  --cwd ./tests/fixtures/multi-package-project --mode batch

# Test hierarchy targeting
deno run --allow-read --allow-write --allow-run --allow-env ./mod.ts \
  --cwd ./tests/fixtures/multi-package-project --hierarchy ./pkg/math

# Test error handling
deno run --allow-read --allow-write --allow-run --allow-env ./mod.ts \
  --cwd ./tests/fixtures/problematic-go-project --log-mode normal
```
