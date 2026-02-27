import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * プロジェクト全体の共通設定
 */
export const config = {
  // チャンクキャッシュの保存先（テストなどで動的に変更可能）
  cacheDir: path.join(__dirname, '../data/chunks'),
};
