const { McpServer } = require('@modelcontextprotocol/sdk');
import * as analysisService from '../analysisService';
import { analyzeProjectTool, getChunkTool } from '../server'; // Import the actual tools

// Mock the analysisService
jest.mock('../analysisService');
const mockedAnalysisService = analysisService as jest.Mocked<typeof analysisService>;


describe('MCP Server Tools with Mocked Service', () => {
  let server: any;

  beforeAll(async () => {
    server = new McpServer({
      tools: [analyzeProjectTool, getChunkTool],
      port: 0, // Use a random free port
    });
    await server.listen();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('analyze_project tool', () => {
    it('should successfully call the analysis service', async () => {
      const projectPath = './src';
      const targetFile = 'Example.swift';
      const successResponse = { message: 'Analysis successful' };
      mockedAnalysisService.analyzeAndStoreProject.mockResolvedValue(successResponse as any);

      const response = await fetch(`http://localhost:${server.port}/tools/analyze_project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, targetFile }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(successResponse);
      expect(mockedAnalysisService.analyzeAndStoreProject).toHaveBeenCalledWith(
        expect.stringContaining(targetFile),
        projectPath
      );
    });

    it('should handle errors from the analysis service', async () => {
        mockedAnalysisService.analyzeAndStoreProject.mockRejectedValue(new Error('Analysis failed'));

        const response = await fetch(`http://localhost:${server.port}/tools/analyze_project`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectPath: './src', targetFile: 'file.swift' }),
        });

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error).toContain('Analysis failed');
    });
  });

  describe('get_chunk tool', () => {
    it('should retrieve a chunk successfully', async () => {
      const projectPath = './src';
      const chunkId = 'chunk1';
      const mockChunk = { id: chunkId, content: 'test content' };
      mockedAnalysisService.getChunkFromStore.mockReturnValue(mockChunk as any);

      const response = await fetch(`http://localhost:${server.port}/tools/get_chunk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, chunkId }),
      });

      expect(response.status).toBe(200);
      expect(mockedAnalysisService.getChunkFromStore).toHaveBeenCalledWith(projectPath, chunkId);
    });

    it('should return an error if chunk is not found', async () => {
        mockedAnalysisService.getChunkFromStore.mockReturnValue(undefined);

        const response = await fetch(`http://localhost:${server.port}/tools/get_chunk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectPath: './src', chunkId: 'not-found' }),
        });

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error).toContain('Chunk with ID not-found not found');
    });
  });
});
