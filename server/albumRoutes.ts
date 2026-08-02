import express from 'express';
import path from 'path';
import fs from 'fs';
import { albumsRepo } from './db';
import { Album, AlbumMedia } from '../src/types';

export const albumRouter = express.Router();

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// /uploads 配下のファイルのみを安全に削除（パストラバーサル防止）
function deleteUploadedFile(url: string) {
  if (!url || !url.startsWith('/uploads/')) return;
  const relative = url.replace(/^\/uploads\//, '');
  const target = path.resolve(UPLOADS_DIR, relative);
  // 解決後のパスが UPLOADS_DIR 配下であることを検証
  if (!target.startsWith(path.resolve(UPLOADS_DIR) + path.sep)) return;
  fs.promises.unlink(target).catch(() => {
    /* 既に無いファイルは無視 */
  });
}

// アルバム一覧取得（所有者ごと）
albumRouter.get('/albums', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ error: 'userId を指定してください。' });
  }
  res.json(albumsRepo.forOwner(userId));
});

// アルバム作成
albumRouter.post('/albums', (req, res) => {
  const { ownerId, name, items } = req.body as { ownerId: string; name: string; items?: Partial<AlbumMedia>[] };
  if (!ownerId || !name?.trim()) {
    return res.status(400).json({ error: 'ownerId と name を指定してください。' });
  }

  const now = new Date().toISOString();
  const album: Album = {
    id: `album-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    ownerId,
    name: name.trim(),
    items: (items || []).map((it, idx) => normalizeMedia(it, idx)),
    createdAt: now,
    updatedAt: now,
  };

  albumsRepo.insert(album);
  res.json(album);
});

// アルバム名変更
albumRouter.patch('/albums/:id', (req, res) => {
  const album = albumsRepo.get(req.params.id);
  if (!album) {
    return res.status(404).json({ error: 'アルバムが見つかりません。' });
  }
  const { name } = req.body as { name?: string };
  if (name?.trim()) {
    album.name = name.trim();
    album.updatedAt = new Date().toISOString();
    albumsRepo.save(album);
  }
  res.json(album);
});

// アルバム削除（内包メディアのアップロードファイルも削除）
albumRouter.delete('/albums/:id', (req, res) => {
  const album = albumsRepo.get(req.params.id);
  if (!album) {
    return res.status(404).json({ error: 'アルバムが見つかりません。' });
  }
  album.items.forEach((item) => {
    deleteUploadedFile(item.url);
    if (item.thumbUrl) deleteUploadedFile(item.thumbUrl);
  });
  albumsRepo.delete(album.id);
  res.json({ success: true });
});

// アルバムへメディア追加
albumRouter.post('/albums/:id/media', (req, res) => {
  const album = albumsRepo.get(req.params.id);
  if (!album) {
    return res.status(404).json({ error: 'アルバムが見つかりません。' });
  }
  const { items } = req.body as { items: Partial<AlbumMedia>[] };
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '追加するメディアを指定してください。' });
  }
  const newItems = items.map((it, idx) => normalizeMedia(it, idx));
  album.items = [...newItems, ...album.items];
  album.updatedAt = new Date().toISOString();
  albumsRepo.save(album);
  res.json(album);
});

// アルバム内メディア削除（アップロードファイルも削除）
albumRouter.delete('/albums/:id/media/:mediaId', (req, res) => {
  const album = albumsRepo.get(req.params.id);
  if (!album) {
    return res.status(404).json({ error: 'アルバムが見つかりません。' });
  }
  const media = album.items.find((m) => m.id === req.params.mediaId);
  if (media) {
    deleteUploadedFile(media.url);
    if (media.thumbUrl) deleteUploadedFile(media.thumbUrl);
  }
  album.items = album.items.filter((m) => m.id !== req.params.mediaId);
  album.updatedAt = new Date().toISOString();
  albumsRepo.save(album);
  res.json(album);
});

// メディアオブジェクトの正規化
function normalizeMedia(it: Partial<AlbumMedia>, idx: number): AlbumMedia {
  return {
    id: `media-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
    type: it.type === 'video' ? 'video' : 'photo',
    url: it.url || '',
    thumbUrl: it.thumbUrl,
    title: it.title || '写真',
    createdAt: new Date().toISOString(),
  };
}
