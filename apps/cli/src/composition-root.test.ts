import { describe, expect, it } from 'vitest';
import { createCompositionRoot } from './composition-root.js';

describe('composition root', () => {
  it('exposes the lifecycle service through the application boundary', () => {
    const composition = createCompositionRoot();

    expect(composition.lifecycleService).toBeDefined();
    expect(typeof composition.lifecycleService.start).toBe('function');
    expect(typeof composition.lifecycleService.status).toBe('function');
  });
});