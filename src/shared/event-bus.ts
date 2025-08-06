/**
 * Event Bus Implementation
 * Re-exports event bus from events.ts
 */

import { SimpleEventBus } from './events.ts';
import type { EventBus } from './events.ts';

/**
 * Create a simple event bus
 */
export const createEventBus = (_options?: { maxLogSize?: number }): EventBus => {
  // SimpleEventBus doesn't take options in the current implementation
  // We'll just create a new instance
  return new SimpleEventBus();
};
