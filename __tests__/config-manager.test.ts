import { ConfigManager } from '../src/config-manager';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    // Reset singleton instance (this is tricky with singletons,
    // usually need to expose a method to reset or re-instantiate)
    // For this test, we might just test the public methods assuming it's already initialized
    // or we can use a fresh instance if we modify the class to allow it for testing.

    // Instead of messing with the singleton, let's just test the public API on the instance we get.
    // However, since it reads from FS in constructor, we need to mock FS before getting instance.
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    // We can't easily reset the singleton in TS without extra code in the class.
    // So we'll get the instance and update it.
    configManager = ConfigManager.getInstance();
  });

  test('should return default config if no file exists', () => {
    const config = configManager.getConfig();
    expect(config.model).toBeDefined();
    expect(config.temperature).toBeDefined();
  });

  test('should update config', () => {
    configManager.updateConfig({
      model: 'gpt-4',
      temperature: 0.5
    });

    const config = configManager.getConfig();
    expect(config.model).toBe('gpt-4');
    expect(config.temperature).toBe(0.5);
  });
});
