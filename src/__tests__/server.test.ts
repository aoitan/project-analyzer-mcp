import { toolConfigurations } from '../server.js';

describe('MCP Server Tools', () => {
  it('should have correct number of tool configurations', () => {
    expect(toolConfigurations).toHaveLength(6); // analyze_project, get_chunk, list_functions_in_file, get_function_chunk, find_file, find_function
  });

  it('should have find_file tool configuration', () => {
    const tool = toolConfigurations.find((t) => t.name === 'find_file');
    expect(tool).toBeDefined();
    expect(tool?.config.title).toBe('Find File');
  });

  it('should have find_function tool configuration', () => {
    const tool = toolConfigurations.find((t) => t.name === 'find_function');
    expect(tool).toBeDefined();
    expect(tool?.config.title).toBe('Find Function');
  });

  it('find_file callback should return matching files', async () => {
    const tool = toolConfigurations.find((t) => t.name === 'find_file');
    const result = await tool?.callback({ pattern: 'src/__tests__/dummy.swift' });
    expect(result.content[0].text).toContain(
      '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift',
    );
  });

  it('find_function callback should return matching functions', async () => {
    const tool = toolConfigurations.find((t) => t.name === 'find_function');
    const result = await tool?.callback({
      filePath: '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift',
      functionQuery: 'dummyFunction1',
    });
    expect(result.content[0].text).toContain('func dummyFunction1(param:) -> Int');
  });

  it('list_functions_in_file callback should return dummy function signatures', async () => {
    const tool = toolConfigurations.find((t) => t.name === 'list_functions_in_file');
    const result = await tool?.callback({
      filePath: '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift',
    });
    console.log('Actual result for list_functions_in_file:', result);
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            [
              {
                id: 'func dummyFunction1(param:) -> Int',
                signature: 'func dummyFunction1(param:) -> Int',
              },
              { id: 'func dummyFunction2()', signature: 'func dummyFunction2()' },
            ],
            null,
            2,
          ),
        },
      ],
    });
  });

  it('get_function_chunk callback should return dummy function chunk content', async () => {
    const tool = toolConfigurations.find((t) => t.name === 'get_function_chunk');
    const analyzeTool = toolConfigurations.find((t) => t.name === 'analyze_project');
    await analyzeTool?.callback({
      projectPath: '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/',
    });

    const result = await tool?.callback({
      filePath: '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift',
      functionSignature: 'func dummyFunction1(param:) -> Int',
    });
    expect(result).toEqual({
      content: [
        { type: 'text', text: 'func dummyFunction1(param: String) -> Int {\n    return 1\n}' },
      ],
    });
  });

  it('get_function_chunk callback should return null for non-existent function in existing file', async () => {
    const tool = toolConfigurations.find((t) => t.name === 'get_function_chunk');
    const result = await tool?.callback({
      filePath: '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift',
      functionSignature: 'func nonExistentFunction()',
    });
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Function chunk not found.' }],
      isError: true,
    });
  });
});
