# Go CI ツール 詳細ドメイン設計

## 実装分析による設計の精緻化

実装コードの分析により、当初の6ドメイン設計は以下の実態を持つことが判明した：

### 実装状況
- **実装済み**: `GoCI`, `ProcessRunner`, `FileSystemService`, `CLIParser`, `GoCILogger`
- **部分実装**: `DomainOrchestrator` (統合レイヤーのみ)
- **未実装**: 各ドメインの詳細実装

### 実装から見えた課題
1. **責任の混在**: `GoCI`クラスが複数ドメインの責任を持つ
2. **イベント駆動の不足**: 直接的な依存関係が多い
3. **ステートレス性の不徹底**: 実行状態を保持する箇所が存在

## 詳細ドメイン設計

### 1. アプリケーション制御ドメイン

**実装クラス群**:
```typescript
// 現実装: CLIParser, main.ts
// 新設計: ApplicationController, ConfigurationManager, LifecycleManager
```

**責任の明確化**:
- CLI引数解析 → 設定オブジェクト変換
- アプリケーションライフサイクル管理
- グローバルエラーハンドリング

**イベント定義**:
```typescript
type AppEvent = 
  | { type: "cli-parsed"; config: ParsedConfig }
  | { type: "initialized"; context: AppContext }
  | { type: "shutdown-requested"; reason: string }
  | { type: "fatal-error"; error: Error };
```

### 2. テスト実行エンジンドメイン

**実装クラス群**:
```typescript
// 現実装: ProcessRunner (部分)
// 新設計: GoTestExecutor, CommandBuilder, ProcessManager
```

**責任の純化**:
- `go test`コマンド構築・実行のみに特化
- プロセス管理とストリーム処理
- 終了コードの取得と伝播

**実行戦略**:
```typescript
interface ExecutionPlan {
  readonly targets: ExecutionTarget[];
  readonly environment: Record<string, string>;
  readonly options: GoTestOptions;
}

class GoTestExecutor {
  async execute(plan: ExecutionPlan): Promise<TestExecutionResult> {
    // プロセス実行とストリーム転送のみ
  }
}
```

### 3. エラー判定・実行制御ドメイン

**実装クラス群**:
```typescript
// 現実装: GoCI内に混在
// 新設計: ExitCodeAnalyzer, StrategyController, FallbackExecutor
```

**判定ロジックの分離**:
```typescript
class ExitCodeAnalyzer {
  analyze(exitCode: number): TestResult {
    return {
      success: exitCode === 0,
      shouldContinue: this.strategy === "all-at-once" || exitCode === 0,
      requiresFallback: exitCode !== 0 && this.fallbackEnabled
    };
  }
}
```

**実行戦略の動的切替**:
```typescript
type Strategy = 
  | { type: "all-at-once" }
  | { type: "directory-split"; directories: string[] }
  | { type: "file-by-file"; files: string[] };
```

### 4. ファイル・リソース管理ドメイン

**実装クラス群**:
```typescript
// 現実装: FileSystemService, GoProjectDiscovery
// 現状維持（責任が明確）
```

**インターフェースの整理**:
```typescript
interface ProjectStructure {
  listDirectories(): DirectoryInfo[];
  findTestFiles(dir: string): TestFile[];
  getPackageInfo(path: string): PackageInfo;
}
```

### 5. 検索・統合・拡張機能ドメイン

**実装クラス群**:
```typescript
// 現実装: SimilarTestFinder, SerenaMCPClient
// 現状維持（オプション機能として独立）
```

**制限の明確化**:
- 最大20ファイル制限の実装
- Serena連携のオプション性

### 6. 実行環境制御ドメイン

**実装クラス群**:
```typescript
// 現実装: ProcessRunner内に混在
// 新設計: EnvironmentManager, OutputRouter
```

**環境変数制御の分離**:
```typescript
class EnvironmentManager {
  prepareTestEnvironment(logLevel: LogLevel): Record<string, string> {
    return {
      ...process.env,
      LOG_LEVEL: logLevel,
      GO_TEST_TIMEOUT: this.timeout.toString()
    };
  }
}
```

**出力ルーティング**:
```typescript
class OutputRouter {
  route(stream: NodeJS.ReadableStream, destination: "stdout" | "stderr"): void {
    // パススルー実装
    stream.pipe(process[destination]);
  }
}
```

## ドメイン間の統合

### イベントバスの導入
```typescript
interface EventBus {
  emit<T extends DomainEvent>(event: T): void;
  on<T extends DomainEvent>(type: T["type"], handler: (event: T) => void): void;
}
```

### 依存性注入コンテナ
```typescript
class DomainContainer {
  private readonly instances = new Map<string, any>();
  
  register<T>(token: string, factory: () => T): void {
    this.instances.set(token, factory());
  }
  
  resolve<T>(token: string): T {
    return this.instances.get(token);
  }
}
```

## 実装移行計画

### Phase 1: 責任の分離
1. `GoCI`クラスから各ドメイン責任を抽出
2. 独立したドメインクラスの作成
3. 既存テストの維持

### Phase 2: イベント駆動への移行
1. EventBusの実装
2. 直接依存からイベント通信への置換
3. 非同期処理の整理

### Phase 3: ステートレス化
1. 実行状態の外部化
2. 各実行の独立性確保
3. 並行実行対応

この詳細設計により、現実装の良い部分を活かしながら、ドメイン駆動設計の原則に沿った改善が可能となる。