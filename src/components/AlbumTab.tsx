import React, { useState, useEffect } from 'react';
import {
  Images,
  Plus,
  Trash2,
  X,
  Image as ImageIcon,
  Film,
  FolderPlus,
  Play,
  Upload,
  Video as VideoIcon,
} from 'lucide-react';

export type AlbumMediaType = 'photo' | 'video';

export interface AlbumMedia {
  id: string;
  type: AlbumMediaType;
  url: string;
  title: string;
  createdAt: string;
}

export interface Album {
  id: string;
  name: string;
  items: AlbumMedia[];
  createdAt: string;
}

const INITIAL_ALBUMS: Album[] = [
  {
    id: 'album-1',
    name: '思い出のアルバム',
    createdAt: new Date().toISOString(),
    items: [
      {
        id: 'p-1',
        type: 'photo',
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
        title: 'きれいな海辺景色',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'v-1',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        title: 'ドライブ動画',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'p-2',
        type: 'photo',
        url: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&auto=format&fit=crop&q=80',
        title: 'お気に入りのカフェ',
        createdAt: new Date().toISOString(),
      },
    ],
  },
];

interface AlbumTabProps {
  onOpenAuthModal?: () => void;
  isLoggedIn?: boolean;
}

export const AlbumTab: React.FC<AlbumTabProps> = ({ onOpenAuthModal, isLoggedIn }) => {
  const [albums, setAlbums] = useState<Album[]>(() => {
    try {
      const saved = localStorage.getItem('line_app_albums_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed;
      }
      // Migrate old format if exists
      const oldSaved = localStorage.getItem('line_app_albums');
      if (oldSaved) {
        const oldParsed = JSON.parse(oldSaved);
        return oldParsed.map((a: any) => ({
          id: a.id,
          name: a.name,
          createdAt: a.createdAt,
          items: (a.photos || []).map((p: any) => ({
            id: p.id,
            type: 'photo',
            url: p.url,
            title: p.title || '写真',
            createdAt: p.createdAt,
          })),
        }));
      }
      return INITIAL_ALBUMS;
    } catch {
      return INITIAL_ALBUMS;
    }
  });

  const [activeAlbumId, setActiveAlbumId] = useState<string>(albums[0]?.id || 'album-1');
  const [selectedMedia, setSelectedMedia] = useState<AlbumMedia | null>(null);

  // Modal states
  const [isAddMediaOpen, setIsAddMediaOpen] = useState(false);
  const [isCreateAlbumOpen, setIsCreateAlbumOpen] = useState(false);

  // New media inputs
  const [mediaType, setMediaType] = useState<AlbumMediaType>('photo');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');

  // New album inputs
  const [newAlbumName, setNewAlbumName] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('line_app_albums_v2', JSON.stringify(albums));
    } catch (e) {
      console.error('Failed to save albums to localStorage', e);
    }
  }, [albums]);

  const activeAlbum = albums.find((a) => a.id === activeAlbumId) || albums[0];

  const handleCreateAlbum = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumName.trim()) return;

    const newAlbum: Album = {
      id: `album-${Date.now()}`,
      name: newAlbumName.trim(),
      items: [],
      createdAt: new Date().toISOString(),
    };

    setAlbums((prev) => [newAlbum, ...prev]);
    setActiveAlbumId(newAlbum.id);
    setNewAlbumName('');
    setIsCreateAlbumOpen(false);
  };

  const handleAddMedia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaUrl.trim()) return;

    const newItem: AlbumMedia = {
      id: `media-${Date.now()}`,
      type: mediaType,
      url: mediaUrl.trim(),
      title: mediaTitle.trim() || (mediaType === 'video' ? '無題の動画' : '無題の写真'),
      createdAt: new Date().toISOString(),
    };

    setAlbums((prev) =>
      prev.map((a) => {
        if (a.id === activeAlbumId) {
          return { ...a, items: [newItem, ...(a.items || [])] };
        }
        return a;
      })
    );

    setMediaUrl('');
    setMediaTitle('');
    setIsAddMediaOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video');
      setMediaType(isVideo ? 'video' : 'photo');
      if (!mediaTitle.trim()) {
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setMediaTitle(nameWithoutExt);
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setMediaUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteMedia = (mediaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('このメディアをアルバムから削除しますか？')) return;

    setAlbums((prev) =>
      prev.map((a) => {
        if (a.id === activeAlbumId) {
          return { ...a, items: a.items.filter((p) => p.id !== mediaId) };
        }
        return a;
      })
    );

    if (selectedMedia?.id === mediaId) {
      setSelectedMedia(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
      {/* Top Header */}
      <div className="px-4 py-3 bg-white border-b border-slate-200/80 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Images className="w-5 h-5 text-emerald-500" />
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">アルバム</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateAlbumOpen(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-bold transition flex items-center gap-1"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>新規アルバム</span>
          </button>
          <button
            onClick={() => setIsAddMediaOpen(true)}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-xs font-bold transition flex items-center gap-1 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>追加</span>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Album Selector Chips */}
        {albums.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {albums.map((album) => (
              <button
                key={album.id}
                onClick={() => setActiveAlbumId(album.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                  activeAlbumId === album.id
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{album.name}</span>
                <span className="opacity-75 font-normal text-[10px]">({album.items?.length || 0})</span>
              </button>
            ))}
          </div>
        )}

        {/* Media Items Grid Section */}
        {activeAlbum && activeAlbum.items && activeAlbum.items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {activeAlbum.items.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedMedia(item)}
                className="group relative aspect-square bg-slate-900 rounded-2xl overflow-hidden cursor-pointer border border-slate-200/80 shadow-xs hover:shadow-md transition"
              >
                {item.type === 'video' ? (
                  <div className="w-full h-full relative flex items-center justify-center bg-black">
                    <video
                      src={item.url}
                      className="w-full h-full object-cover opacity-80"
                      muted
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-xs text-white flex items-center justify-center border border-white/30 group-hover:scale-110 transition">
                        <Play className="w-5 h-5 ml-0.5 fill-current" />
                      </div>
                    </div>
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 rounded-md text-[10px] font-bold text-white flex items-center gap-1">
                      <Film className="w-3 h-3 text-purple-400" />
                      <span>動画</span>
                    </div>
                  </div>
                ) : (
                  <img
                    src={item.url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                )}

                {/* Title overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 flex flex-col justify-end text-white">
                  <p className="text-xs font-bold line-clamp-1">{item.title}</p>
                </div>

                <button
                  onClick={(e) => handleDeleteMedia(item.id, e)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition z-10"
                  title="削除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">写真・動画がありません</h3>
              <p className="text-xs text-slate-500 mt-1">
                右上の「追加」ボタンから写真や動画にタイトルを付けて保存できます。
              </p>
            </div>
            <button
              onClick={() => setIsAddMediaOpen(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition shadow-xs"
            >
              写真・動画を追加する
            </button>
          </div>
        )}
      </div>

      {/* Media Viewer Modal */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative max-w-2xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setSelectedMedia(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition"
            >
              <X className="w-6 h-6" />
            </button>

            {selectedMedia.type === 'video' ? (
              <video
                src={selectedMedia.url}
                controls
                autoPlay
                className="max-h-[75vh] w-auto max-w-full rounded-2xl shadow-2xl bg-black"
              />
            ) : (
              <img
                src={selectedMedia.url}
                alt={selectedMedia.title}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl"
              />
            )}

            <div className="mt-4 text-center text-white">
              <div className="flex items-center justify-center gap-1.5">
                {selectedMedia.type === 'video' ? (
                  <Film className="w-4 h-4 text-purple-400" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                )}
                <h3 className="font-bold text-lg">{selectedMedia.title}</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(selectedMedia.createdAt).toLocaleDateString('ja-JP')} 追加
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Media Modal */}
      {isAddMediaOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">写真・動画をアルバムに追加</h3>
              <button
                onClick={() => setIsAddMediaOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMedia} className="space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">種類</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setMediaType('photo')}
                    className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                      mediaType === 'photo'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>写真 (画像)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMediaType('video')}
                    className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                      mediaType === 'video'
                        ? 'bg-white text-purple-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Film className="w-4 h-4" />
                    <span>動画</span>
                  </button>
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  タイトル <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={mediaTitle}
                  onChange={(e) => setMediaTitle(e.target.value)}
                  placeholder={mediaType === 'video' ? '例: 夏休みのビーチ動画' : '例: 山頂からの絶景'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ファイルを選択 (端末からアップロード)
                </label>
                <input
                  type="file"
                  accept={mediaType === 'video' ? 'video/*' : 'image/*'}
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                />
              </div>

              <div className="text-center text-[11px] text-slate-400 font-medium my-1">— または URL / サンプル —</div>

              {/* URL Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {mediaType === 'video' ? '動画 URL を直接入力' : '画像 URL を直接入力'}
                </label>
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder={
                    mediaType === 'video'
                      ? 'https://example.com/video.mp4'
                      : 'https://example.com/photo.jpg'
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Sample Buttons */}
              <div className="flex gap-2">
                {mediaType === 'video' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMediaUrl(
                        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
                      );
                      if (!mediaTitle) setMediaTitle('サンプルドライブ動画');
                    }}
                    className="text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 rounded-lg border border-purple-200 transition"
                  >
                    + サンプル動画をセット
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMediaUrl(
                        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80'
                      );
                      if (!mediaTitle) setMediaTitle('サンプル沖縄の海');
                    }}
                    className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg border border-emerald-200 transition"
                  >
                    + サンプル画像をセット
                  </button>
                )}
              </div>

              {/* Preview */}
              {mediaUrl && (
                <div className="p-2 border rounded-xl bg-slate-900 text-center">
                  <p className="text-[10px] text-slate-400 mb-1">プレビュー</p>
                  {mediaType === 'video' ? (
                    <video src={mediaUrl} controls className="max-h-36 mx-auto rounded-lg" />
                  ) : (
                    <img src={mediaUrl} alt="Preview" className="max-h-36 mx-auto rounded-lg object-cover" />
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={!mediaUrl.trim()}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition shadow-xs"
              >
                アルバムに追加保存
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Album Modal */}
      {isCreateAlbumOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">新規アルバムの作成</h3>
              <button
                onClick={() => setIsCreateAlbumOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAlbum} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">アルバム名</label>
                <input
                  type="text"
                  required
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  placeholder="例: 家族旅行 / 趣味の動画・写真"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition shadow-xs"
              >
                アルバムを作成
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
