import express from 'express';
import path from 'path';
import fs from 'fs';

export const musicRouter = express.Router();

// docker-compose.yml の /share/music_mount:/app/smb_music ボリュームマウント先
const MUSIC_BASE = process.env.SMB_MOUNT || '/app/smb_music';

const AUDIO_EXT = new Set(['.mp3', '.flac', '.m4a', '.ogg', '.wav', '.aac', '.opus', '.wma', '.mp4', '.webm']);
const MIME_MAP: Record<string, string> = {
  '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.aac': 'audio/aac',
  '.opus': 'audio/opus', '.wma': 'audio/x-ms-wma', '.mp4': 'audio/mp4', '.webm': 'audio/webm',
};

function resolveSafe(reqPath: string): string {
  const rel = reqPath.replace(/\.\./g, '').replace(/\\/g, '/').replace(/^\/+/, '');
  const full = path.resolve(MUSIC_BASE, rel);
  if (!full.startsWith(path.resolve(MUSIC_BASE))) throw new Error('Invalid path');
  return full;
}

// ディレクトリ一覧（ホストマウント済み CIFS パスを fs で読む）
musicRouter.get('/browse', (req, res) => {
  const reqPath = typeof req.query.path === 'string' ? req.query.path : '';
  try {
    const full = resolveSafe(reqPath);
    if (!fs.existsSync(full)) {
      return res.status(404).json({ success: false, error: `パスが見つかりません: ${reqPath || '/'}` });
    }
    const entries = fs.readdirSync(full, { withFileTypes: true });
    const items = entries
      .filter(e => !e.name.startsWith('.') && !e.name.startsWith('$'))
      .map(e => {
        const ext = path.extname(e.name).toLowerCase();
        const isDir = e.isDirectory();
        return { name: e.name, path: reqPath ? `${reqPath}/${e.name}` : e.name, isDir, isAudio: !isDir && AUDIO_EXT.has(ext), ext };
      })
      .sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name, 'ja')));
    res.json({ success: true, path: reqPath, items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 音声ストリーミング（Range 対応でシーク可能）
musicRouter.get('/stream', (req, res) => {
  const reqPath = typeof req.query.path === 'string' ? req.query.path : '';
  if (!reqPath) return res.status(400).json({ error: 'path required' });
  try {
    const full = resolveSafe(reqPath);
    const stat = fs.statSync(full);
    const total = stat.size;
    const ext = path.extname(full).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const range = req.headers.range;
    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : total - 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': contentType,
      });
      fs.createReadStream(full, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Length': total, 'Content-Type': contentType, 'Accept-Ranges': 'bytes' });
      fs.createReadStream(full).pipe(res);
    }
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

