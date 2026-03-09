import * as path from 'path';
import * as os from 'os';

/**
 * プロジェクト全体の共通設定
 */
export const config = {
  // チャンクキャッシュの保存先（環境変数またはデフォルトのホームディレクトリ）
  cacheDir:
    process.env.MCP_CACHE_DIR || path.join(os.homedir(), '.mcp-code-analysis-server'),
};
