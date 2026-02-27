import { createHash } from 'crypto';

/**
 * 文字列のSHA-256ハッシュを計算する。
 * @param content ハッシュを計算する文字列
 * @returns 64文字の16進数ハッシュ文字列
 */
export function calculateHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}
