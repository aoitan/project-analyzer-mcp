import { describe, it, expect, beforeEach } from 'vitest';
import { AnalysisAdapter } from '../interfaces/AnalysisAdapter.js';
import { GraphNode, GraphEdge } from '../types.js';

// ---- モックアダプタの実装 ----
export class MockAnalysisAdapter implements AnalysisAdapter {
  private isInitialized = false;

  async initialize(projectPath: string): Promise<void> {
    this.isInitialized = true;
  }

  async shutdown(): Promise<void> {
    this.isInitialized = false;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }

  async getSymbolAtPoint(
    filePath: string,
    line: number,
    column: number,
  ): Promise<GraphNode | null> {
    if (!this.isInitialized) throw new Error('Adapter not initialized');

    if (filePath === '/test/ClassA.swift' && line === 10) {
      return {
        id: 'usr-class-a-func-b',
        name: 'funcB',
        kind: 'function',
        filePath: '/test/ClassA.swift',
      };
    }
    return null;
  }

  async getReferences(symbolId: string): Promise<GraphNode[]> {
    if (!this.isInitialized) throw new Error('Adapter not initialized');

    if (symbolId === 'usr-class-a-func-b') {
      return [
        {
          id: 'usr-class-caller-func-c',
          name: 'funcC',
          kind: 'function',
          filePath: '/test/Caller.swift',
        },
      ];
    }
    return [];
  }

  async getOutgoingCalls(symbolId: string): Promise<GraphNode[]> {
    if (!this.isInitialized) throw new Error('Adapter not initialized');

    if (symbolId === 'usr-class-a-func-b') {
      return [
        {
          id: 'usr-class-callee-func-d',
          name: 'funcD',
          kind: 'function',
          filePath: '/test/Callee.swift',
        },
      ];
    }
    return [];
  }
}

// ---- テストケース ----
describe('MockAnalysisAdapter', () => {
  let adapter: MockAnalysisAdapter;

  beforeEach(() => {
    adapter = new MockAnalysisAdapter();
  });

  it('初期化前はエラーを投げること', async () => {
    await expect(adapter.getSymbolAtPoint('/test.swift', 1, 1)).rejects.toThrow(
      'Adapter not initialized',
    );
  });

  it('初期化後に正しくシンボルを取得できること', async () => {
    await adapter.initialize('/test/project');
    const symbol = await adapter.getSymbolAtPoint('/test/ClassA.swift', 10, 1);

    expect(symbol).not.toBeNull();
    expect(symbol?.name).toBe('funcB');
    expect(symbol?.kind).toBe('function');
  });

  it('指定したシンボルの参照元（Caller）を取得できること', async () => {
    await adapter.initialize('/test/project');
    const refs = await adapter.getReferences('usr-class-a-func-b');

    expect(refs).toHaveLength(1);
    expect(refs[0].name).toBe('funcC');
    expect(refs[0].id).toBe('usr-class-caller-func-c');
  });

  it('指定したシンボルの呼び出し先（Callee）を取得できること', async () => {
    await adapter.initialize('/test/project');
    const calls = await adapter.getOutgoingCalls('usr-class-a-func-b');

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('funcD');
  });
});
