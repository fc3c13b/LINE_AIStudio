import express from 'express';
import path from 'path';

export const musicRouter = express.Router();

const SMB_HOST = process.env.SMB_HOST || '100.71.203.9';
const SMB_SHARE = process.env.SMB_SHARE || 'music';
const SMB_USER = process.env.SMB_USERNAME || 'guest';
const SMB_PASS = process.env.SMB_PASSWORD || '';
const SMB_DOMAIN = process.env.SMB_DOMAIN || 'WORKGROUP';

const AUDIO_EXT = new Set(['.mp3', '.flac', '.m4a', '.ogg', '.wav', '.aac', '.opus', '.wma', '.mp4', '.webm']);
const MIME_MAP: Record<string, string> = {
  '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.aac': 'audio/aac',
  '.opus': 'audio/opus', '.wma': 'audio/x-ms-wma', '.mp4': 'audio/mp4', '.webm': 'audio/webm',
};

// @ts-ignore
let SMB2Class: any = null;
try { SMB2Class = require('@marsaud/smb2'); } catch {
  console.warn('[MUSIC] @marsaud/smb2 not found. Music endpoints will return error.');
}

function createClient() {
  if (!SMB2Class) throw new Error('@marsaud/smb2 not installed');
  return new SMB2Class({
    share: '\\\\' + SMB_HOST + '\\' + SMB_SHARE,
    domain: SMB_DOMAIN,
    username: SMB_USER,
    password: SMB_PASS,
    autoCloseTimeout: 10000,
  });
}

function normPath(p: string): string {
  return p.replace(/\.\./g, '').replace(/^[/\\]+/, '').replace(/\//g, '\\').trim();
}

// ディレクトリ一覧
musicRouter.get('/browse', async (req, res) => {
  const reqPath = normPath(typeof req.query.path === 'string' ? req.query.path : '');
  let client: any;
  try {
    client = createClient();
    const entries: string[] = await client.readdir(reqPath || '');
    const items = entries
      .filter(n => !n.startsWith('.') && !n.startsWith('$'))
      .map(name => {
        const ext = path.extname(name).toLowerCase();
        const isAudio = AUDIO_EXT.has(ext);
        // 拡張子なし or 音声でない = フォルダとみなす
        const isDir = !ext || !AUDIO_EXT.has(ext);
        return { name, path: reqPath ? reqPath + '\\' + name : name, isAudio, isDir, ext };
      })
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name, 'ja');
      });
    res.json({ success: true, path: reqPath, items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'SMB browse failed' });
  } finally {
    try { client?.disconnect?.(); client?.close?.(); } catch {}
  }
});

// 音声ファイルストリーミング
musicRouter.get('/stream', async (req, res) => {
  const filePath = normPath(typeof req.query.path === 'string' ? req.query.path : '');
  if (!filePath) return res.status(400).json({ error: 'path required' });
  let client: any;
  try {
    client = createClient();
    const ext = path.extname(filePath).toLowerCase();
    const readStream: any = await client.createReadStream(filePath);
    res.setHeader('Content-Type', MIME_MAP[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    readStream.pipe(res);
    res.on('close', () => { try { client?.disconnect?.(); client?.close?.(); } catch {} });
  } catch (err: any) {
    try { client?.disconnect?.(); client?.close?.(); } catch {}
    if (!res.headersSent) res.status(500).json({ error: err.message || 'SMB stream failed' });
  }
});
