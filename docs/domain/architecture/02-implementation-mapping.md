# 実装マッピングと型定義詳細

## 現実装から新ドメイン設計へのマッピング

### 1. アプリケーション制御ドメイン

**現実装の分析**:
- `CLIParser`: 引数解析のみ（責任明確）
- `main.ts`: ライフサイクル管理が分散
- エラーハンドリング: 各所に散在

**新実装の型定義**:
```typescript
// Application State (全域性原則適用)
type AppState = 
  | { type: "initializing"; startTime: number }
  | { type: "running"; config: ValidatedConfig; startTime: number }
  | { type: "shutting-down"; reason: string; exitCode: number }
  | { type: "terminated"; exitCode: number; duration: number };

// Configuration with Smart Constructor
class ValidatedConfig {
  private constructor(
    private readonly data: Readonly<{
      workingDir: string;
      mode: ExecutionMode;
      batchSize: number;
      timeout: number;
    }>
  ) {}

  static create(raw: unknown): Result<ValidatedConfig, ConfigError> {
    // バリデーションロジック
  }
}

// Lifecycle Manager
class ApplicationLifecycle {
  private state: AppState = { type: "initializing", startTime: Date.now() };
  
  transition(event: AppEvent): Result<void, StateError> {
    // 状態遷移の全域性保証
  }
}
```

### 2. テスト実行エンジンドメイン

**現実装の分析**:
- `ProcessRunner`: 汎用的すぎる
- `GoCI.runStage()`: ドメインロジック混在

**新実装の型定義**:
```typescript
// Execution Target (Discriminated Union)
type Target = 
  | { type: "all"; pattern: "./..." }
  | { type: "directory"; path: string; recursive: boolean }
  | { type: "file"; path: string; testName?: string }
  | { type: "package"; import: string };

// Go Test Command Builder
class GoTestCommand {
  private constructor(
    private readonly parts: readonly string[]
  ) {}

  static build(target: Target, options: TestOptions): GoTestCommand {
    const cmd = ["go", "test"];
    
    switch (target.type) {
      case "all":
        return new GoTestCommand([...cmd, target.pattern]);
      case "directory":
        return new GoTestCommand([...cmd, target.path]);
      case "file":
        return new GoTestCommand([...cmd, "-run", target.testName || ".", target.path]);
      case "package":
        return new GoTestCommand([...cmd, target.import]);
    }
  }
}

// Process Execution Result
type ExecResult = {
  readonly exitCode: number;
  readonly signal?: string;
  readonly duration: number;
  readonly killed: boolean;
};
```

### 3. エラー判定・実行制御ドメイン

**現実装の分析**:
- エラー判定: `GoCI`内にハードコード
- 実行制御: モード別分岐が複雑

**新実装の型定義**:
```typescript
// Exit Code Classification
type ExitCodeMeaning = 
  | { type: "success"; code: 0 }
  | { type: "test-failure"; code: 1 }
  | { type: "build-error"; code: 2 }
  | { type: "timeout"; code: 124 }
  | { type: "unknown"; code: number };

// Execution Decision
type Decision = 
  | { action: "continue"; reason: string }
  | { action: "stop"; reason: string; error?: Error }
  | { action: "fallback"; strategy: FallbackStrategy };

// Strategy Controller
class ExecutionStrategyController {
  private currentStrategy: Strategy = { type: "all-at-once" };
  
  makeDecision(result: ExitCodeMeaning, context: ExecContext): Decision {
    switch (result.type) {
      case "success":
        return { action: "continue", reason: "Test passed" };
      case "test-failure":
        if (this.currentStrategy.type === "all-at-once") {
          return { action: "fallback", strategy: { type: "directory-split" } };
        }
        return { action: "stop", reason: "Test failed in granular mode" };
      default:
        return { action: "stop", reason: "Unexpected error", error: new Error(`Exit code: ${result.code}`) };
    }
  }
}
```

### 4. ファイル・リソース管理ドメイン

**現実装の分析**:
- `FileSystemService`: 適切な抽象化
- `GoProjectDiscovery`: Go特化で良い

**型定義の改善**:
```typescript
// Directory Structure (既存を改善)
interface DirectoryNode {
  readonly path: string;
  readonly depth: number;
  readonly children: readonly DirectoryNode[];
  readonly stats: DirectoryStats;
}

interface DirectoryStats {
  readonly hasGoFiles: boolean;
  readonly hasTestFiles: boolean;
  readonly hasGoMod: boolean;
  readonly testFileCount: number;
  readonly totalSize: number;
}

// Project Scanner Result
type ScanResult = 
  | { type: "module"; root: string; packages: PackageInfo[] }
  | { type: "workspace"; roots: string[]; modules: ModuleInfo[] }
  | { type: "simple"; packages: PackageInfo[] };
```

### 5. 検索・統合・拡張機能ドメイン

**現実装の分析**:
- `SimilarTestFinder`: 基本実装あり
- `SerenaMCPClient`: 外部依存を適切に分離

**型定義の強化**:
```typescript
// Similarity Search (20ファイル制限)
class LimitedSearchResult {
  private constructor(
    private readonly files: readonly SimilarFile[],
  ) {}

  static create(files: SimilarFile[]): LimitedSearchResult {
    return new LimitedSearchResult(files.slice(0, 20));
  }

  getFiles(): readonly SimilarFile[] {
    return this.files;
  }
}

// Search Strategy
type SearchStrategy = 
  | { type: "local"; algorithm: "name" | "import" | "ast" }
  | { type: "serena"; endpoint: string; timeout: number }
  | { type: "hybrid"; localFirst: boolean };
```

### 6. 実行環境制御ドメイン

**現実装の分析**:
- 環境変数管理: `ProcessRunner`に混在
- 出力制御: 直接pipe実装

**新実装の型定義**:
```typescript
// Environment Configuration
type EnvConfig = 
  | { type: "inherit"; additions: Record<string, string> }
  | { type: "clean"; vars: Record<string, string> }
  | { type: "debug"; baseVars: Record<string, string> };

// Output Configuration  
type OutputConfig = 
  | { type: "passthrough"; stdout: boolean; stderr: boolean }
  | { type: "capture"; bufferSize: number }
  | { type: "tee"; destinations: OutputDestination[] };

// Stream Router
class StreamRouter {
  route(source: NodeJS.ReadableStream, config: OutputConfig): void {
    switch (config.type) {
      case "passthrough":
        if (config.stdout) source.pipe(process.stdout);
        if (config.stderr) source.pipe(process.stderr);
        break;
      // 他のケース実装
    }
  }
}
```

## Result型による全域性の実現

すべてのドメイン操作は`Result<T, E>`を返す：

```typescript
// 共通エラー型
type DomainError = 
  | { domain: "app"; kind: "config" | "state" | "lifecycle"; details: any }
  | { domain: "exec"; kind: "command" | "process" | "timeout"; details: any }
  | { domain: "error"; kind: "analysis" | "strategy" | "fallback"; details: any }
  | { domain: "resource"; kind: "notfound" | "access" | "parse"; details: any }
  | { domain: "search"; kind: "limit" | "timeout" | "external"; details: any }
  | { domain: "env"; kind: "variable" | "stream" | "permission"; details: any };

// ドメイン操作の例
async function executeTest(target: Target): Promise<Result<ExecResult, DomainError>> {
  // 全ての異常系を型で表現
}
```

この詳細な型定義により、実装の移行パスが明確になり、既存コードの良い部分を保持しながら、ドメイン駆動設計の原則に沿った改善が可能となる。