# Go Local CI Examples

This directory contains examples of how to use @tettuan/go-local-ci with different Go project structures.

## Example Go Project

```bash
# Create a simple Go project
mkdir example-go-project
cd example-go-project

# Initialize Go module
go mod init example

# Create main.go
cat > main.go << 'EOF'
package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}

func Add(a, b int) int {
    return a + b
}
EOF

# Create main_test.go
cat > main_test.go << 'EOF'
package main

import "testing"

func TestAdd(t *testing.T) {
    result := Add(2, 3)
    if result != 5 {
        t.Errorf("Add(2, 3) = %d; want 5", result)
    }
}
EOF

# Run Go CI
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci
```

## Multi-Package Project

```bash
# Create a multi-package project
mkdir multi-package-project
cd multi-package-project

# Initialize Go module
go mod init example.com/myproject

# Create pkg/math/math.go
mkdir -p pkg/math
cat > pkg/math/math.go << 'EOF'
package math

func Add(a, b int) int {
    return a + b
}

func Multiply(a, b int) int {
    return a * b
}
EOF

# Create pkg/math/math_test.go
cat > pkg/math/math_test.go << 'EOF'
package math

import "testing"

func TestAdd(t *testing.T) {
    if Add(2, 3) != 5 {
        t.Error("Add(2, 3) should equal 5")
    }
}

func TestMultiply(t *testing.T) {
    if Multiply(2, 3) != 6 {
        t.Error("Multiply(2, 3) should equal 6")
    }
}
EOF

# Create cmd/calculator/main.go
mkdir -p cmd/calculator
cat > cmd/calculator/main.go << 'EOF'
package main

import (
    "fmt"
    "example.com/myproject/pkg/math"
)

func main() {
    result := math.Add(10, 20)
    fmt.Printf("10 + 20 = %d\n", result)
}
EOF

# Run Go CI on the entire project
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci

# Run Go CI on specific package
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci ./pkg/math

# Run Go CI in batch mode
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --mode batch --batch-size 3
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Go CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  go-ci:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Go
      uses: actions/setup-go@v5
      with:
        go-version: '1.21'
    
    - name: Setup Deno
      uses: denoland/setup-deno@v2
      with:
        deno-version: v2.x
    
    - name: Run Go CI
      run: |
        deno run --allow-read --allow-write --allow-run --allow-env \
          jsr:@tettuan/go-local-ci --log-mode silent
```

### Docker

```dockerfile
FROM golang:1.21-alpine AS builder

# Install Deno
RUN apk add --no-cache curl unzip
RUN curl -fsSL https://deno.land/install.sh | sh
ENV PATH="/root/.deno/bin:${PATH}"

WORKDIR /app
COPY . .

# Run Go CI
RUN deno run --allow-read --allow-write --allow-run --allow-env \
    jsr:@tettuan/go-local-ci --log-mode silent

# Build the application
RUN go build -o main ./cmd/myapp

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
CMD ["./main"]
```

## Advanced Usage

### Debug Mode

```bash
# Enable debug logging for troubleshooting
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --log-mode debug --log-key GO_DEBUG --log-length L
```

### Filtering Tests

```bash
# Run only integration tests
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --test-filter "*integration*"

# Run only unit tests (exclude integration)
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --test-filter "^((?!integration).)*$"
```

### Working with Go Workspaces

```bash
# If you have go.work file
deno run --allow-read --allow-write --allow-run --allow-env jsr:@tettuan/go-local-ci \
  --verbose --mode batch
```
