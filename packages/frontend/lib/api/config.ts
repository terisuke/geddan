/**
 * API設定
 * 環境変数でモックAPIと実APIを切り替え可能
 */

// モックAPIを使用するかどうか（開発・テスト用）
export const USE_MOCK_API =
  process.env.NEXT_PUBLIC_USE_MOCK_API === 'true' ||
  process.env.NODE_ENV === 'test';

// API Base URL
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

