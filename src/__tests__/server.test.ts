import { toolConfigurations } from '../server';

describe('MCP Server Tools', () => {
  it('should have correct number of tool configurations', () => {
    expect(toolConfigurations).toHaveLength(4);
  });

  it('should have analyze_project tool configuration', () => {
    const tool = toolConfigurations.find((t) => t.name === 'analyze_project');
    expect(tool).toBeDefined();
    expect(tool?.config.title).toBe('Analyze Project');
  });

  it('should have get_chunk tool configuration', () => {
    const tool = toolConfigurations.find((t) => t.name === 'get_chunk');
    expect(tool).toBeDefined();
    expect(tool?.config.title).toBe('Get Code Chunk');
  });

  it('should have list_functions_in_file tool configuration', () => {
    const tool = toolConfigurations.find((t) => t.name === 'list_functions_in_file');
    expect(tool).toBeDefined();
    expect(tool?.config.title).toBe('List Functions in File');
  });

  it('should have get_function_chunk tool configuration', () => {
    const tool = toolConfigurations.find((t) => t.name === 'get_function_chunk');
    expect(tool).toBeDefined();
    expect(tool?.config.title).toBe('Get Function Code Chunk');
  });

  it('analyze_project callback should return success message', async () => {
    const tool = toolConfigurations.find((t) => t.name === 'analyze_project');
    const result = await tool?.callback({
      projectPath: '/Users/ma-yabushita/00_work/study/ai/toy',
    });
    expect(result).toEqual({ status: 'success', message: 'Project analysis completed.' });
  });

  it('get_chunk callback should return dummy chunk content', async () => {
    const tool = toolConfigurations.find((t) => t.name === 'get_chunk');
    // First, analyze a project to populate chunks
    const analyzeTool = toolConfigurations.find((t) => t.name === 'analyze_project');
    await analyzeTool?.callback({ projectPath: '/Users/ma-yabushita/00_work/study/ai/toy' });

    const result = await tool?.callback({ chunkId: 'func dummyFunction1(param:) -> Int' });
    expect(result).toEqual({ status: 'success', chunk: 'return 1' });
  });

  it('list_functions_in_file callback should return dummy function signatures', async () => {
    const tool = toolConfigurations.find((t) => t.name === 'list_functions_in_file');
    const result = await tool?.callback({
      filePath: '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift',
    });
    expect(result).toEqual([
      { signature: 'func dummyFunction1(param:) -> Int' },
      { signature: 'func dummyFunction2()' },
    ]);
  });

  it('get_function_chunk callback should return dummy function chunk content', async () => {
    const tool = toolConfigurations.find((t) => t.name === 'get_function_chunk');
    const result = await tool?.callback({
      filePath: '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift',
      functionSignature: 'func dummyFunction1(param:) -> Int',
    });
    expect(result?.content).toContain('return 1');
  });

  it('get_chunk callback should return error for non-existent chunk', async () => {
    const tool = toolConfigurations.find((t) => t.name === 'get_chunk');
    const result = await tool?.callback({ chunkId: 'non_existent_chunk_id' });
    expect(result).toEqual({ status: 'error', message: 'Chunk not found.' });
  });

  it('list_functions_in_file callback should return empty array for non-existent file', async () => {
    const tool = toolConfigurations.find((t) => t.name === 'list_functions_in_file');
    const result = await tool?.callback({ filePath: '/path/to/non_existent_file.swift' });
    expect(result).toEqual([]);
  });

  it('get_function_chunk callback should return null for non-existent file', async () => {
    const tool = toolConfigurations.find((t) => t.name === 'get_function_chunk');
    const result = await tool?.callback({
      filePath: '/path/to/non_existent_file.swift',
      functionSignature: 'func someFunction()',
    });
    expect(result).toBeNull();
  });

  it('get_function_chunk callback should return null for non-existent function in existing file', async () => {
    const tool = toolConfigurations.find((t) => t.name === 'get_function_chunk');
    const result = await tool?.callback({
      filePath: '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift',
      functionSignature: 'func nonExistentFunction()',
    });
    expect(result).toBeNull();
  });
});
