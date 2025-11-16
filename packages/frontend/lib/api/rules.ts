import axios from 'axios';
import { API_BASE_URL } from './config';

export interface UploadRules {
  max_file_size_mb: number;
  max_file_size_bytes: number;
  allowed_types: string[];
  allowed_extensions: string[];
}

let cachedRules: UploadRules | null = null;
let rulesPromise: Promise<UploadRules> | null = null;

/**
 * アップロードバリデーションルールを取得
 * キャッシュ機能付き
 */
export async function getUploadRules(): Promise<UploadRules> {
  // キャッシュがあれば返す
  if (cachedRules) {
    return cachedRules;
  }

  // 既にリクエスト中の場合はそのPromiseを返す
  if (rulesPromise) {
    return rulesPromise;
  }

  // 新規リクエスト
  rulesPromise = (async () => {
    try {
      const response = await axios.get<UploadRules>(
        `${API_BASE_URL}/api/upload/rules`
      );
      cachedRules = response.data;
      return cachedRules;
    } catch (error) {
      // エラー時はデフォルト値を返す
      console.warn('Failed to fetch upload rules, using defaults', error);
      return {
        max_file_size_mb: 100,
        max_file_size_bytes: 100 * 1024 * 1024,
        allowed_types: ['video/mp4', 'image/gif'],
        allowed_extensions: ['.mp4', '.gif'],
      };
    } finally {
      rulesPromise = null;
    }
  })();

  return rulesPromise;
}

/**
 * キャッシュをクリア（テスト用）
 */
export function clearRulesCache(): void {
  cachedRules = null;
  rulesPromise = null;
}

