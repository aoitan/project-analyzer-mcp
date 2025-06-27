// src/__tests__/analysisService.test.ts
import * as fs from 'fs';
import * as path from 'path';
import { analyzeAndStoreProject, getChunkFromStore, parsedProjects } from '../analysisService';
import * as parser from '../parser';

// Mock the parser module
jest.mock('../parser');
const mockedParser = parser as jest.Mocked<typeof parser>;

// Mock fs.promises to avoid actual file system writes during tests
jest.mock('fs', () => ({
    ...jest.requireActual('fs'), // Keep original fs for other uses
    promises: {
        ...jest.requireActual('fs').promises,
        writeFile: jest.fn().mockResolvedValue(undefined),
    },
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
}));

describe('analysisService', () => {
    const mockProjectPath = './src';
    const mockFileName = 'Example.swift';
    const mockFullFilePath = path.join(process.cwd(), mockProjectPath, mockFileName);

    beforeEach(() => {
        // Clear mocks and in-memory store before each test
        (fs.promises.writeFile as jest.Mock).mockClear();
        mockedParser.parseSwiftFileWithSourceKitten.mockClear();
        // Clear the in-memory project store
        for (const key in parsedProjects) {
            delete parsedProjects[key];
        }
    });

    it('should analyze a project, store it, and persist chunks', async () => {
        const mockChunks = {
            'Example.swift_MyClass_1': {
                id: 'Example.swift_MyClass_1',
                name: 'MyClass',
                type: 'class' as const,
                content: 'class MyClass {}',
                filePath: mockFullFilePath,
                startLine: 1,
                endLine: 1,
                byteOffset: 0,
                byteLength: 16,
                calls: [],
            },
        };
        mockedParser.parseSwiftFileWithSourceKitten.mockResolvedValue(mockChunks);

        const result = await analyzeAndStoreProject(mockFullFilePath, mockProjectPath);

        // Check if parser was called
        expect(mockedParser.parseSwiftFileWithSourceKitten).toHaveBeenCalledWith(mockFullFilePath);
        
        // Check if the result is stored in memory
        expect(parsedProjects[mockProjectPath]).toEqual(mockChunks);

        // Check if chunks are persisted to the filesystem
        expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
        expect(fs.promises.writeFile).toHaveBeenCalledWith(
            expect.stringContaining('Example.swift_MyClass_1.swiftchunk'),
            'class MyClass {}',
            'utf-8'
        );

        // Check the returned summary
        expect(result.message).toContain('Successfully analyzed');
        expect(result.extractedChunks).toHaveLength(1);
        expect(result.extractedChunks[0].id).toBe('Example.swift_MyClass_1');
    });

    it('should retrieve a chunk from the store', () => {
        const chunkId = 'test_chunk_1';
        parsedProjects[mockProjectPath] = {
            [chunkId]: {
                id: chunkId, name: 'testFunc', type: 'function', content: 'func test() {}', filePath: mockFullFilePath, startLine: 1, endLine: 1, byteOffset: 0, byteLength: 15, calls: []
            }
        };

        const chunk = getChunkFromStore(mockProjectPath, chunkId);
        expect(chunk).toBeDefined();
        expect(chunk?.id).toBe(chunkId);
    });

    it('should return undefined for a non-existent chunk', () => {
        const chunk = getChunkFromStore(mockProjectPath, 'non_existent_chunk');
        expect(chunk).toBeUndefined();
    });

    it('should return undefined for a non-analyzed project', () => {
        const chunk = getChunkFromStore('./non_existent_project', 'any_chunk');
        expect(chunk).toBeUndefined();
    });
});
