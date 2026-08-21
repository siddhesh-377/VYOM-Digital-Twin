import { describe, it, expect, vi, afterEach } from 'vitest';
import { eventBus } from '../engines/MissionEventBus';

describe('MissionEventBus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delivers payload to subscribed callback', () => {
    const cb = vi.fn();
    eventBus.subscribe('EVENT', cb);
    eventBus.publish('EVENT', { value: 42 });
    expect(cb).toHaveBeenCalledWith({ value: 42 });
  });

  it('supports multiple subscribers', () => {
    const a = vi.fn();
    const b = vi.fn();
    eventBus.subscribe('EVENT', a);
    eventBus.subscribe('EVENT', b);
    eventBus.publish('EVENT', 1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('does not deliver to other events', () => {
    const cb = vi.fn();
    eventBus.subscribe('OTHER', cb);
    eventBus.publish('EVENT', 1);
    expect(cb).not.toHaveBeenCalled();
  });

  it('unsubscribe stops delivery', () => {
    const cb = vi.fn();
    const unsub = eventBus.subscribe('EVENT', cb);
    unsub();
    eventBus.publish('EVENT', 1);
    expect(cb).not.toHaveBeenCalled();
  });

  it('ignores unknown events on unsubscribe', () => {
    expect(() => eventBus.unsubscribe('NOPE', vi.fn())).not.toThrow();
  });

  it('publishing with no listeners is a no-op', () => {
    expect(() => eventBus.publish('EMPTY', {})).not.toThrow();
  });
});