/**
 * Domain event definitions for event-driven architecture
 * All events follow Discriminated Union pattern
 */

// Application Control Domain Events
export type ApplicationEvent =
  | { type: 'app:initialized'; config: unknown; timestamp: number }
  | { type: 'app:config-changed'; changes: unknown; timestamp: number }
  | { type: 'app:shutdown-started'; reason: string; timestamp: number }
  | {
    type: 'app:error-trapped';
    error: Error;
    severity: 'fatal' | 'recoverable';
    timestamp: number;
  };

// Test Execution Domain Events
export type ExecutionEvent =
  | { type: 'exec:started'; target: string; env: Record<string, string>; timestamp: number }
  | {
    type: 'exec:completed';
    target: string;
    exitCode: number;
    duration: number;
    timestamp: number;
  }
  | { type: 'exec:failed'; target: string; error: Error; timestamp: number }
  | { type: 'exec:progress'; target: string; percentage: number; timestamp: number };

// Error Control Domain Events
export type ErrorControlEvent =
  | { type: 'error:detected'; exitCode: number; context: unknown; timestamp: number }
  | { type: 'error:strategy-selected'; strategy: string; reason: string; timestamp: number }
  | { type: 'error:fallback-triggered'; from: string; to: string; timestamp: number }
  | { type: 'error:threshold-exceeded'; metric: string; value: number; timestamp: number };

// Resource Management Domain Events
export type ResourceEvent =
  | { type: 'resource:scan-started'; path: string; depth: number; timestamp: number }
  | { type: 'resource:package-found'; packageName: string; path: string; timestamp: number }
  | { type: 'resource:scan-completed'; total: number; duration: number; timestamp: number }
  | { type: 'resource:access-denied'; path: string; error: Error; timestamp: number };

// Search Integration Domain Events
export type SearchEvent =
  | { type: 'search:started'; criteria: unknown; timestamp: number }
  | { type: 'search:match-found'; file: string; score: number; timestamp: number }
  | { type: 'search:completed'; matches: number; limited: boolean; timestamp: number }
  | { type: 'search:external-timeout'; service: string; timestamp: number };

// Environment Control Domain Events
export type EnvironmentEvent =
  | { type: 'env:configured'; vars: string[]; mode: 'debug' | 'normal'; timestamp: number }
  | { type: 'env:stream-connected'; streamType: 'stdout' | 'stderr'; timestamp: number }
  | { type: 'env:output-captured'; size: number; timestamp: number }
  | {
    type: 'env:resource-limit';
    resourceType: 'memory' | 'cpu';
    usage: number;
    timestamp: number;
  }
  | { type: 'environment:setup-complete'; envVars: number; workDir: string; timestamp: number }
  | { type: 'environment:cleanup-complete'; errors: number; timestamp: number };

// Union of all domain events
export type DomainEvent =
  | ApplicationEvent
  | ExecutionEvent
  | ErrorControlEvent
  | ResourceEvent
  | SearchEvent
  | EnvironmentEvent;

/**
 * Event handler type
 */
export type EventHandler<T extends DomainEvent> = (event: T) => Promise<void> | void;

/**
 * Event bus interface
 */
export interface EventBus {
  emit<T extends DomainEvent>(event: T): Promise<void>;
  on<T extends DomainEvent>(
    eventType: T['type'],
    handler: EventHandler<T>,
  ): () => void; // Returns unsubscribe function
  off<T extends DomainEvent>(
    eventType: T['type'],
    handler: EventHandler<T>,
  ): void;
}

/**
 * Simple event bus implementation
 */
export class SimpleEventBus implements EventBus {
  // Use DomainEvent here to allow different event types, but ensure type safety through methods
  private handlers = new Map<string, Set<EventHandler<DomainEvent>>>();

  async emit<T extends DomainEvent>(event: T): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers) return;

    const promises = Array.from(handlers).map((handler) =>
      Promise.resolve(handler(event)).catch((error) =>
        console.error(`Event handler error for ${event.type}:`, error)
      )
    );

    await Promise.all(promises);
  }

  on<T extends DomainEvent>(
    eventType: T['type'],
    handler: EventHandler<T>,
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    this.handlers.get(eventType)!.add(handler as EventHandler<DomainEvent>);

    // Return unsubscribe function
    return () => this.off(eventType, handler);
  }

  off<T extends DomainEvent>(
    eventType: T['type'],
    handler: EventHandler<T>,
  ): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler as EventHandler<DomainEvent>);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }
}

/**
 * Create event with timestamp
 */
export const createEvent = <T extends Omit<DomainEvent, 'timestamp'>>(
  event: T,
): T & { timestamp: number } => ({
  ...event,
  timestamp: Date.now(),
});
