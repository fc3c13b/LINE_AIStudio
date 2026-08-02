import type { CapacitorConfig } from '@capacitor/cli';

const NAS_URL = process.env.VITE_API_BASE_URL || '';

const config: CapacitorConfig = {
  appId: 'com.lineaistudio.dev',
  appName: 'LINE AIStudio',
  webDir: 'dist',
  // Android アプリがサーバーに接続するための NAS URL
  server: NAS_URL ? { url: NAS_URL, cleartext: true } : undefined,
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
