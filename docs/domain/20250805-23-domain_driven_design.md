# Go CI ツール ドメイン設計

## ツールの本質

**Goテスト実行のラッパー** - `go test`を効率的に実行する制御ツール

制御内容：
1. **実行ファイル数制御** - 全体実行 or ディレクトリ単位分割
2. **LOG_LEVEL制御** - 通常実行 or debug実行の切替
3. **実行順序制御** - エラー時の中断と類似テスト検索

設計原則：ステートレス、ファイル・ディレクトリ把握のみ、Goテスト出力をパススルー、終了コードベースの判定

## 設計哲学

### 中心極限定理による境界線導出
**何度も出現する要素は、ドメインの中心である。** 高頻度出現要素を中心核とし、関連要素を同一ドメインに集約。

### ユースケース要求
1. **CI完了速度向上** - 全体テストの即時pass判定
2. **詳細分析精度向上** - ディレクトリ単位での段階的エラー特定
3. **問題把握容易性向上** - 類似テストの並行実行とdebugログ出力

### 6つのドメイン分離
1. **CLI解析・設定構築** (24/24)
2. **テスト実行エンジン** (24/24)  
3. **エラー判定・実行制御** (20/24→24/24)
4. **ファイル・リソース管理** (16/24,20/24)
5. **検索・外部連携** (8/24)
6. **実行環境制御** (24/24)

## ドメイン設計原理

### 全域性原則
- **Result型**: 例外を値として表現
- **Discriminated Union**: 状態ベースの表現
- **Smart Constructor**: 制約付き値の保護
- **網羅的分岐**: switch文による全状態処理

### ライフサイクル分離
- **永続的**: アプリケーション制御
- **セッション**: テスト実行、エラー処理
- **一時的**: ファイル・リソース管理
- **外部依存**: 検索・拡張機能

## 1. アプリケーション制御ドメイン

**責任**: CLI解析〜終了まで、全体生存期間の制御

**効果**: 設定一元化、初期化制御、グローバル例外処理、リソース管理

**特徴**: 長期生存、設定権威、制御中枢、例外最終処理

```typescript
type ApplicationState = "initializing" | "running" | "shutting-down" | "terminated";
type Configuration = { readonly [K in ConfigKey]: ConfigValue<K> };
type ProcessControl = { gracefulShutdown(): Promise<void>; forceTerminate(): void; };
```

**イベント**: 
- 出力: `initialization-completed`, `configuration-changed`, `shutdown-requested`
- 入力: `domain-error`, `resource-warning`

## 2. テスト実行エンジンドメイン

**責任**: `go test`コマンドの実行制御

**効果**: Goテスト実行制御、即時pass判定、実行単位管理、プロセス管理

**特徴**: コマンド実行特化、ステートレス、終了コード取得、出力転送

```typescript
type GoTestCommand = { 
  buildCommand(target: string, env?: Record<string, string>): string[];
  execute(): Promise<{ exitCode: number }>;
};
type ExecutionTarget = "./..." | DirectoryPath | FilePath;
```

**イベント**:
- 出力: `execution-started`, `stage-completed`, `execution-failed`
- 入力: `resource-allocated`, `fallback-strategy`, `similar-tests-found`

## 3. エラー判定・実行制御ドメイン

**責任**: Goテスト終了コード判定、実行戦略切替

**効果**: 終了コード判定、実行戦略切替、最初のエラーで中断、段階的実行

**特徴**: 判定特化、戦略切替、中断制御、ステートレス

```typescript
type ExitCodeChecker = { isSuccess(exitCode: number): boolean; };
type ExecutionStrategy = "all-at-once" | "directory-by-directory" | "file-by-file";
```

**イベント**:
- 出力: `error-analyzed`, `fallback-activated`
- 入力: `execution-error`

## 4. ファイル・リソース管理ドメイン

**責任**: ディレクトリ・ファイル操作の基盤機能

**効果**: ディレクトリ階層管理、プロジェクト理解、テストファイル検出

**特徴**: 基盤性、短寿命、並行性、抽象性

```typescript
type DirectoryHierarchy = { 
  listAllDirectories(): DirectoryPath[];
  getTestFiles(dir: DirectoryPath): TestFile[];
};
```

**イベント**:
- 出力: `project-discovered`, `resource-warning`
- 入力: `scan-request`, `resource-limit`

## 5. 検索・統合・拡張機能ドメイン

**責任**: 類似テスト検索、Serena連携

**効果**: 類似テスト検索、最大20ファイル制限、問題特定支援

**特徴**: オプション性、外部依存、非同期性、拡張性

```typescript
type SimilarTestFinder = { findSimilar(errorFile: TestFile): SimilarFile[]; limit: 20; };
type SerenaSearcher = { search(file: TestFile): Promise<SimilarFile[]> };
```

**イベント**:
- 出力: `similar-found`, `external-insight`
- 入力: `test-failed`, `similarity-request`

## 6. 実行環境制御ドメイン

**責任**: `go test`実行時の環境変数制御

**効果**: LOG_LEVEL制御、環境変数管理、出力パススルー

**特徴**: 環境制御、パススルー、ステートレス、シンプル

```typescript
type EnvironmentController = { 
  setLogLevel(level: "debug" | "info"): void;
  getEnvironment(): Record<string, string>;
};
type OutputPassthrough = { pipe(goTestOutput: Stream): void; };
```

## ドメイン間結合戦略

**強結合**: 制御→実行、実行→リソース、全て→出力
**中結合**: 実行→エラー処理、エラー処理→リソース
**疎結合**: 実行→拡張機能、拡張機能→出力

## ユースケース実現フロー

### 成功パス
1. CLI初期化 → 2. `go test ./...`実行 → 3. 終了コード0で即完了 → 4. 出力パススルー

### エラー時パス
1. 非0終了コード → 2. ディレクトリ単位分割 → 3. 階層リスト化 → 4. 最初のエラーで中断
→ 5. Serena類似検索 → 6. 最大20ファイルをLOG_LEVEL=debugで実行 → 7. 出力転送

## 設計品質指標

- **分離度**: 独立テスト可能、状態共有なし、イベント駆動
- **凝集度**: 単一責任、ライフサイクル一貫性、変更理由単一性
- **ステートレス性**: 内部メモリなし、都度判定、透過的転送
- **要求充足**: 即時完了、ディレクトリ分割、debugログ実行

Goテスト実行ラッパーとしての本質的責任に集中した、ステートレスで効率的なCIツール設計。