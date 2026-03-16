import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';

describe('config', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.MCP_CACHE_DIR;
  });

  it('should have a default cacheDir under the home directory', async () => {
    const homeDir = os.homedir();
    const expectedPath = path.join(homeDir, '.mcp-code-analysis-server');

    const { config } = await import('../config.js');

    expect(config.cacheDir).toBe(expectedPath);
  });

  it('should allow overriding cacheDir with MCP_CACHE_DIR environment variable', async () => {
    const customPath = '/tmp/custom-mcp-cache';
    process.env.MCP_CACHE_DIR = customPath;

    const { config } = await import('../config.js');

    expect(config.cacheDir).toBe(customPath);
  });
});
