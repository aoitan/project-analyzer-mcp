// src/analysisService.ts
import * as fs from 'fs';
import * as path from 'path';
import { parseSwiftFileWithSourceKitten } from './parser';
import { SimpleDependencyGraph } from './types';

// This would typically be a more robust in-memory store or a database interface.
export const parsedProjects: { [projectPath: string]: SimpleDependencyGraph } = {};

const CHUNK_STORAGE_DIR = path.join(__dirname, '../data/chunks');
if (!fs.existsSync(CHUNK_STORAGE_DIR)) {
    fs.mkdirSync(CHUNK_STORAGE_DIR, { recursive: true });
}

/**
 * Analyzes a project file, stores the results in memory and persists chunks to the filesystem.
 * @param fullFilePath The absolute path to the file to analyze.
 * @param projectPath The relative project path used as a key for storage.
 * @returns An object containing the count of chunks and a summary of extracted chunks.
 */
export async function analyzeAndStoreProject(fullFilePath: string, projectPath: string) {
    const chunks = await parseSwiftFileWithSourceKitten(fullFilePath);
    
    // Store the full analysis result in memory.
    parsedProjects[projectPath] = chunks;

    // Persist each chunk to the filesystem.
    for (const chunkId in chunks) {
        const chunk = chunks[chunkId];
        const chunkFileName = `${chunk.id}.swiftchunk`;
        const chunkFilePath = path.join(CHUNK_STORAGE_DIR, chunkFileName);
        await fs.promises.writeFile(chunkFilePath, chunk.content, 'utf-8');
    }

    const chunkCount = Object.keys(chunks).length;
    console.log(`[INFO] Analysis complete. Found ${chunkCount} chunks.`);

    return {
        message: `Successfully analyzed ${path.basename(fullFilePath)}. ${chunkCount} chunks extracted.`,
        extractedChunks: Object.values(chunks).slice(0, 5).map(c => ({ id: c.id, name: c.name, type: c.type, calls: c.calls }))
    };
}

/**
 * Retrieves a specific chunk from the in-memory store.
 * @param projectPath The project path key.
 * @param chunkId The ID of the chunk to retrieve.
 * @returns The target CodeChunk or undefined if not found.
 */
export function getChunkFromStore(projectPath: string, chunkId: string) {
    const projectChunks = parsedProjects[projectPath];
    if (!projectChunks) {
        return undefined;
    }
    return projectChunks[chunkId];
}
