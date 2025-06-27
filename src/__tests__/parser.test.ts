import { runSourceKitten, transformStructureToChunks } from '../parser';
import { SourceKittenStructure, SimpleDependencyGraph } from '../types';
import * as path from 'path';
import * as fs from 'fs';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  exec: jest.fn((command, callback) => {
    const mockOutput: SourceKittenStructure = {
        key: 'key.structure',
        kind: 'source.lang.swift.syntaxtype.comment',
        substructure: [
        {
          kind: 'source.lang.swift.decl.class',
          name: 'MyClass',
          offset: 28,
          length: 305,
          line: 4,
          substructure: [
            {
              kind: 'source.lang.swift.decl.function.method.instance',
              name: 'greet(person:)',
              offset: 98,
              length: 150,
              line: 11,
            },
          ],
        },
      ],
    };
    callback(null, { stdout: JSON.stringify(mockOutput), stderr: '' });
  }),
}));

describe('runSourceKitten', () => {
  it('should execute sourcekitten command and return parsed JSON', async () => {
    const result = await runSourceKitten('/fake/path/to/file.swift');
    expect(result).toHaveProperty('substructure');
    expect(Array.isArray(result.substructure)).toBe(true);
  });
});

describe('transformStructureToChunks', () => {
  const mockFileContent = `class MyClass {
  func greet(person: String) {}
}`;
  const mockFilePath = '/fake/path/to/MyClass.swift';
  const mockStructure: SourceKittenStructure = {
    key: 'key.structure',
    kind: 'source.lang.swift.syntaxtype.comment',
    substructure: [
      {
        kind: 'source.lang.swift.decl.class',
        name: 'MyClass',
        offset: 0,
        length: 41,
        line: 1,
        substructure: [
          {
            kind: 'source.lang.swift.decl.function.method.instance',
            name: 'greet(person:)',
            offset: 18,
            length: 21,
            line: 2,
          },
        ],
      },
    ],
  };

  it('should transform sourcekitten structure to chunks', () => {
    const chunks = transformStructureToChunks(mockStructure, mockFileContent, mockFilePath);
    expect(Object.keys(chunks).length).toBe(2);
    expect(chunks['MyClass.swift_MyClass_1']).toBeDefined();
    expect(chunks['MyClass.swift_MyClass_1'].type).toBe('class');
    expect(chunks['MyClass.swift_greet(person:)_2'].type).toBe('function');
  });
});

