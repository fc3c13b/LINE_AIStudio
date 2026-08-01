declare const __LINE_API_BASE_URL__: string;

const configuredBaseUrl = __LINE_API_BASE_URL__.trim();

// Browser builds keep same-origin requests. Native builds provide the NAS URL
// at build time, for example: VITE_API_BASE_URL=http://192.168.1.20:3000
export const API_BASE_URL = configuredBaseUrl
  ? configuredBaseUrl.replace(/\/$/, '')
  : '';

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export async function readApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('サーバーへ接続できません。NASの接続先設定を確認してください。');
  }
  return response.json() as Promise<T>;
}
