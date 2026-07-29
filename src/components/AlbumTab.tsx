import React, { useState, useEffect } from 'react';
import { Images, Plus, Trash2, X, Image as ImageIcon, Sparkles, FolderPlus } from 'lucide-react';

export interface AlbumPhoto {
  id: string;
  url: string;
  title: string;
  createdAt: string;
}

export interface Album {
  id: string;
  name: string;
  photos: AlbumPhoto[];
  createdAt: string;
}

const INITIAL_ALBUMS: Album[] = [
  {
    id: 'album-1',
    name: '思い出フォト',
    createdAt: new Date().toISOString(),
    photos: [
      {
        id: 'p-1',
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
        title: 'きれいな海辺',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'p-2',
        url: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&auto=format&fit=crop&q=80',
        title: 'お気に入りのカフェ',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'p-3',
        url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80',
        title: '山でのハイキング',
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
      const saved = localStorage.getItem('line_app_albums');
      return saved ? JSON.parse(saved) : INITIAL_ALBUMS;
    } catch {
      return INITIAL_ALBUMS;
    }
  });

  const [activeAlbumId, setActiveAlbumId] = useState<string>(albums[0]?.id || 'album-1');
  const [selectedPhoto, setSelectedPhoto] = useState<AlbumPhoto | null>(null);

  // Modal states
  const [isAddPhotoOpen, setIsAddPhotoOpen] = useState(false);
  const [isCreateAlbumOpen, setIsCreateAlbumOpen] = useState(false);

  // New photo inputs
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoTitle, setPhotoTitle] = useState('');

  // New album inputs
  const [newAlbumName, setNewAlbumName] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('line_app_albums', JSON.stringify(albums));
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
      photos: [],
      createdAt: new Date().toISOString(),
    };

    setAlbums((prev) => [newAlbum, ...prev]);
    setActiveAlbumId(newAlbum.id);
    setNewAlbumName('');
    setIsCreateAlbumOpen(false);
  };

  const handleAddPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrl.trim()) return;

    const newPhoto: AlbumPhoto = {
      id: `photo-${Date.now()}`,
      url: photoUrl.trim(),
      title: photoTitle.trim() || '無題の写真',
      createdAt: new Date().toISOString(),
    };

    setAlbums((prev) =>
      prev.map((a) => {
        if (a.id === activeAlbumId) {
          return { ...a, photos: [newPhoto, ...a.photos] };
        }
        return a;
      })
    );

    setPhotoUrl('');
    setPhotoTitle('');
    setIsAddPhotoOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeletePhoto = (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('この写真をアルバムから削除しますか？')) return;

    setAlbums((prev) =>
      prev.map((a) => {
        if (a.id === activeAlbumId) {
          return { ...a, photos: a.photos.filter((p) => p.id !== photoId) };
        }
        return a;
      })
    );

    if (selectedPhoto?.id === photoId) {
      setSelectedPhoto(null);
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
            onClick={() => setIsAddPhotoOpen(true)}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-xs font-bold transition flex items-center gap-1 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>写真を追加</span>
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
                <span className="opacity-75 font-normal text-[10px]">({album.photos.length})</span>
              </button>
            ))}
          </div>
        )}

        {/* Photos Grid Section */}
        {activeAlbum && activeAlbum.photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {activeAlbum.photos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                className="group relative aspect-square bg-slate-200 rounded-2xl overflow-hidden cursor-pointer border border-slate-200/80 shadow-xs hover:shadow-md transition"
              >
                <img
                  src={photo.url}
                  alt={photo.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition p-2.5 flex flex-col justify-end text-white">
                  <p className="text-xs font-bold line-clamp-1">{photo.title}</p>
                </div>

                <button
                  onClick={(e) => handleDeletePhoto(photo.id, e)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition"
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
              <h3 className="font-bold text-slate-800 text-sm">写真がありません</h3>
              <p className="text-xs text-slate-500 mt-1">
                右上の「写真を追加」ボタンからお気に入りの写真をアルバムに保存できます。
              </p>
            </div>
            <button
              onClick={() => setIsAddPhotoOpen(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition shadow-xs"
            >
              写真をアップロードする
            </button>
          </div>
        )}
      </div>

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative max-w-2xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition"
            >
              <X className="w-6 h-6" />
            </button>

            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.title}
              className="max-h-[75vh] w-auto object-contain rounded-2xl shadow-2xl"
            />

            <div className="mt-4 text-center text-white">
              <h3 className="font-bold text-lg">{selectedPhoto.title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(selectedPhoto.createdAt).toLocaleDateString('ja-JP')} 追加
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Photo Modal */}
      {isAddPhotoOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">写真をアルバムに追加</h3>
              <button
                onClick={() => setIsAddPhotoOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPhoto} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  画像ファイルのアップロード
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                />
              </div>

              <div className="text-center text-xs text-slate-400 font-medium my-1">— または —</div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  画像 URL を直接指定
                </label>
                <input
                  type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs text-slate-800 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">タイトル / キャプション</label>
                <input
                  type="text"
                  value={photoTitle}
                  onChange={(e) => setPhotoTitle(e.target.value)}
                  placeholder="例: 夏休みの思い出"
                  className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs text-slate-800 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {photoUrl && (
                <div className="p-2 border rounded-xl bg-slate-50 text-center">
                  <p className="text-[10px] text-slate-500 mb-1">プレビュー</p>
                  <img
                    src={photoUrl}
                    alt="Preview"
                    className="max-h-32 mx-auto rounded-lg object-cover"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={!photoUrl.trim()}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition shadow-xs"
              >
                アルバムに保存する
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
                  placeholder="例: 家族旅行 / 趣味の写真"
                  className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs text-slate-800 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
