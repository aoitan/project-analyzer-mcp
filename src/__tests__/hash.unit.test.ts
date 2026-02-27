import { describe, it, expect } from 'vitest';
import { calculateHash } from '../utils/hash.js';

describe('Hash Utility', () => {
  it('同じ文字列に対して常に同じハッシュを生成すること', () => {
    const content = 'func test() { print("hello") }';
    const hash1 = calculateHash(content);
    const hash2 = calculateHash(content);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256
  });

  it('わずかな違いで異なるハッシュを生成すること', () => {
    const content1 = 'func test() { print("hello") }';
    const content2 = 'func test() { print("hello!") }';
    expect(calculateHash(content1)).not.toBe(calculateHash(content2));
  });
});
