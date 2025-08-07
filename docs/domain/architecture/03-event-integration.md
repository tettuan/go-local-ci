# ドメイン間イベント統合設計

## イベント駆動アーキテクチャの詳細

### イベントフローの全体像

```
[CLI] → AppControlDomain → [init-complete] → ExecutionDomain
                         ↓
                    [config-loaded] 
                         ↓
                    ResourceDomain ← [scan-request]
                         ↓
                    [resources-found]
                         ↓
                    ExecutionDomain → [test-start] → EnvironmentDomain
                         ↓
                    [test-complete]
                         ↓
                    ErrorControlDomain → [strategy-change] → ExecutionDomain
                         ↓
                    [error-detected]
                         ↓
                    SearchDomain → [similar-found] → ExecutionDomain
```

### ドメインイベント定義

```typescript
// 1. Application Control Events
type AppControlEvent = 
  | { type: "app:initialized"; config: ValidatedConfig; timestamp: number }
  | { type: "app:config-changed"; changes: ConfigDelta; timestamp: number }
  | { type: "app:shutdown-started"; reason: string; timestamp: number }
  | { type: "app:error-trapped"; error: Error; severity: "fatal" | "recoverable" };

// 2. Execution Engine Events  
type ExecutionEvent =
  | { type: "exec:started"; target: Target; env: Record<string, string> }
  | { type: "exec:completed"; target: Target; result: ExecResult }
  | { type: "exec:failed"; target: Target; error: Error }
  | { type: "exec:progress"; target: Target; percentage: number };

// 3. Error Control Events
type ErrorControlEvent =
  | { type: "error:detected"; code: number; context: ExecContext }
  | { type: "error:strategy-selected"; strategy: Strategy; reason: string }
  | { type: "error:fallback-triggered"; from: Strategy; to: Strategy }
  | { type: "error:threshold-exceeded"; metric: string; value: number };

// 4. Resource Management Events
type ResourceEvent =
  | { type: "resource:scan-started"; path: string; depth: number }
  | { type: "resource:package-found"; pkg: PackageInfo }
  | { type: "resource:scan-completed"; total: number; duration: number }
  | { type: "resource:access-denied"; path: string; error: Error };

// 5. Search Integration Events
type SearchEvent =
  | { type: "search:started"; criteria: SearchCriteria }
  | { type: "search:match-found"; file: string; score: number }
  | { type: "search:completed"; matches: number; limited: boolean }
  | { type: "search:external-timeout"; service: string };

// 6. Environment Control Events
type EnvControlEvent =
  | { type: "env:configured"; vars: string[]; mode: "debug" | "normal" }
  | { type: "env:stream-connected"; type: "stdout" | "stderr" }
  | { type: "env:output-captured"; size: number }
  | { type: "env:resource-limit"; type: "memory" | "cpu"; usage: number };
```

### イベントバス実装

```typescript
// Type-safe Event Bus
class DomainEventBus {
  private handlers = new Map<string, Set<Function>>();
  
  // 型安全なイベント登録
  on<T extends DomainEvent>(
    eventType: T["type"],
    handler: (event: T) => void | Promise<void>
  ): () => void {
    const key = eventType;
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set());
    }
    
    this.handlers.get(key)!.add(handler);
    
    // Unsubscribe function
    return () => {
      this.handlers.get(key)?.delete(handler);
    };
  }
  
  // 型安全なイベント発行
  async emit<T extends DomainEvent>(event: T): Promise<void> {
    const handlers = this.handlers.get(event.type) || new Set();
    
    // 並行実行でパフォーマンス向上
    await Promise.all(
      Array.from(handlers).map(handler => 
        Promise.resolve(handler(event)).catch(error => 
          console.error(`Handler error for ${event.type}:`, error)
        )
      )
    );
  }
}
```

### ドメイン間の協調パターン

#### 1. 成功パス（高速完了）
```typescript
// Coordination for success path
class SuccessPathCoordinator {
  async coordinate(bus: DomainEventBus): Promise<void> {
    // 1. App初期化完了を待つ
    await bus.waitFor("app:initialized");
    
    // 2. 全体テスト実行
    await bus.emit({
      type: "exec:started",
      target: { type: "all", pattern: "./..." },
      env: { LOG_LEVEL: "info" }
    });
    
    // 3. 成功時は即座に完了
    bus.on("exec:completed", async (event) => {
      if (event.result.exitCode === 0) {
        await bus.emit({
          type: "app:shutdown-started",
          reason: "All tests passed",
          timestamp: Date.now()
        });
      }
    });
  }
}
```

#### 2. エラーパス（詳細分析）
```typescript
// Coordination for error path
class ErrorPathCoordinator {
  async coordinate(bus: DomainEventBus): Promise<void> {
    // エラー検出時の協調
    bus.on("exec:completed", async (event) => {
      if (event.result.exitCode !== 0) {
        // エラー制御ドメインに通知
        await bus.emit({
          type: "error:detected",
          code: event.result.exitCode,
          context: { target: event.target }
        });
      }
    });
    
    // 戦略変更時の協調
    bus.on("error:strategy-selected", async (event) => {
      if (event.strategy.type === "directory-split") {
        // リソースドメインにスキャン要求
        await bus.emit({
          type: "resource:scan-started",
          path: ".",
          depth: 3
        });
      }
    });
    
    // 類似ファイル検索の協調
    bus.on("error:detected", async (event) => {
      if (event.context.target.type === "file") {
        await bus.emit({
          type: "search:started",
          criteria: {
            file: event.context.target.path,
            maxResults: 20
          }
        });
      }
    });
  }
}
```

### 実行コンテキストの伝播

```typescript
// Cross-domain context
interface ExecutionContext {
  readonly sessionId: string;
  readonly startTime: number;
  readonly config: ValidatedConfig;
  readonly eventHistory: DomainEvent[];
}

// Context-aware event emission
class ContextualEventBus extends DomainEventBus {
  constructor(private context: ExecutionContext) {
    super();
  }
  
  async emit<T extends DomainEvent>(event: T): Promise<void> {
    // コンテキスト情報を自動付与
    const contextualEvent = {
      ...event,
      sessionId: this.context.sessionId,
      timestamp: Date.now()
    };
    
    // 履歴に追加
    this.context.eventHistory.push(contextualEvent);
    
    return super.emit(contextualEvent);
  }
}
```

### エラー境界とリカバリ

```typescript
// Domain error boundary
class DomainErrorBoundary {
  constructor(
    private bus: DomainEventBus,
    private domain: string
  ) {}
  
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: (error: Error) => T
  ): Promise<Result<T, DomainError>> {
    try {
      const result = await operation();
      return success(result);
    } catch (error) {
      // エラーイベント発行
      await this.bus.emit({
        type: "app:error-trapped",
        error: error as Error,
        severity: fallback ? "recoverable" : "fatal"
      });
      
      if (fallback) {
        return success(fallback(error as Error));
      }
      
      return failure({
        domain: this.domain,
        kind: "execution",
        details: error
      } as DomainError);
    }
  }
}
```

### パフォーマンス最適化

```typescript
// Event batching for performance
class BatchedEventBus extends DomainEventBus {
  private queue: DomainEvent[] = [];
  private flushTimer?: NodeJS.Timeout;
  
  async emit<T extends DomainEvent>(event: T): Promise<void> {
    this.queue.push(event);
    
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), 10);
    }
  }
  
  private async flush(): Promise<void> {
    const events = [...this.queue];
    this.queue = [];
    this.flushTimer = undefined;
    
    // バッチ処理
    await Promise.all(events.map(event => super.emit(event)));
  }
}
```

このイベント統合設計により、各ドメインは疎結合を保ちながら、効率的に協調動作することが可能となる。イベント駆動により、将来の拡張や変更にも柔軟に対応できる。