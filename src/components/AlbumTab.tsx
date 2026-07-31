import React, { useState, useEffect, useRef } from 'react';
import {
  Images,
  Plus,
  Trash2,
  X,
  Image as ImageIcon,
  FolderPlus,
  Upload,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Check,
  Edit2,
  Download,
  Film,
  Play,
  Maximize2,
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
  updatedAt?: string;
}

// Preset gallery photos for user selection
const PRESET_SAMPLE_PHOTOS: { url: string; title: string }[] = [
  {
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
    title: '沖縄の美しいビーチ',
  },
  {
    url: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&auto=format&fit=crop&q=80',
    title: 'カフェのラテアート',
  },
  {
    url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=80',
    title: '京都の歴史的街並み',
  },
  {
    url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80',
    title: '東京の綺麗な夜景',
  },
  {
    url: 'https://images.unsplash.com/photo-1528164344705-47542687990d?w=800&auto=format&fit=crop&q=80',
    title: '富士山と桜の絶景',
  },
  {
    url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop&q=80',
    title: '新緑の大自然',
  },
  {
    url: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=800&auto=format&fit=crop&q=80',
    title: 'かわいいペットの犬',
  },
  {
    url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&auto=format&fit=crop&q=80',
    title: 'くつろぐ猫',
  },
  {
    url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop&q=80',
    title: '焼きたてピザ',
  },
  {
    url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&auto=format&fit=crop&q=80',
    title: '休日ドライブ風景',
  },
  {
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
    title: '静かな湖と山々',
  },
  {
    url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&auto=format&fit=crop&q=80',
    title: 'キャンプの夕焼け',
  },
];

const INITIAL_ALBUMS: Album[] = [
  {
    id: 'album-1',
    name: '沖縄旅行の思い出 🌺',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 'p-1',
        type: 'photo',
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
        title: 'きれいな海辺景色',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'p-2',
        type: 'photo',
        url: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&auto=format&fit=crop&q=80',
        title: 'お気に入りのカフェ',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'p-3',
        type: 'photo',
        url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=80',
        title: '歴史的街並み',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'album-2',
    name: 'お気に入り写真 📸',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 'p-4',
        type: 'photo',
        url: 'https://images.unsplash.com/photo-1528164344705-47542687990d?w=800&auto=format&fit=crop&q=80',
        title: '富士山と桜',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'p-5',
        type: 'photo',
        url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80',
        title: '夜景スポット',
        createdAt: new Date().toISOString(),
      },
    ],
  },
];

interface AlbumTabProps {
  onOpenAuthModal?: () => void;
  isLoggedIn?: boolean;
}

export const AlbumTab: React.FC<AlbumTabProps> = () => {
  const [albums, setAlbums] = useState<Album[]>(() => {
    try {
      const saved = localStorage.getItem('line_app_albums_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_ALBUMS;
    } catch {
      return INITIAL_ALBUMS;
    }
  });

  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);

  // Photo Picker Modal States
  // 'closed' | 'select_photos' | 'album_info'
  const [pickerStep, setPickerStep] = useState<'closed' | 'select_photos' | 'album_info'>('closed');
  const [pickerTargetAlbumId, setPickerTargetAlbumId] = useState<string | null>(null); // null = new album, string = add to existing album

  // Selected Photos in Picker (Array of photo objects)
  const [selectedPhotos, setSelectedPhotos] = useState<{ url: string; title: string; type?: 'photo' | 'video' }[]>([]);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');

  // Album Edit / Delete Menu State
  const [menuAlbumId, setMenuAlbumId] = useState<string | null>(null);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameInputValue, setRenameInputValue] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('line_app_albums_v3', JSON.stringify(albums));
    } catch (e) {
      console.error('Failed to save albums to localStorage', e);
    }
  }, [albums]);

  const activeAlbum = albums.find((a) => a.id === activeAlbumId);

  // Open photo picker for creating a new album
  const handleOpenPickerForNewAlbum = () => {
    setPickerTargetAlbumId(null);
    setSelectedPhotos([]);
    const defaultDateName = `${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, '0')}.${String(new Date().getDate()).padStart(2, '0')}のアルバム`;
    setNewAlbumName(defaultDateName);
    setPickerStep('select_photos');
  };

  // Open photo picker to add photos to existing album
  const handleOpenPickerForExistingAlbum = (albumId: string) => {
    setPickerTargetAlbumId(albumId);
    setSelectedPhotos([]);
    setPickerStep('select_photos');
  };

  // Toggle photo selection in picker
  const handleTogglePhotoSelection = (photo: { url: string; title: string; type?: 'photo' | 'video' }) => {
    const existingIndex = selectedPhotos.findIndex((p) => p.url === photo.url);
    if (existingIndex !== -1) {
      setSelectedPhotos((prev) => prev.filter((p) => p.url !== photo.url));
    } else {
      setSelectedPhotos((prev) => [...prev, photo]);
    }
  };

  // Handle uploading local device files (Multiple files selection)
  const handleLocalFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files: File[] = Array.from(fileList);

    files.forEach((file: File) => {
      const isVideo = file.type.startsWith('video');
      const reader = new FileReader();
      reader.onload = async (evt) => {
        if (evt.target?.result) {
          const rawDataUrl = evt.target.result as string;
          let finalUrl = rawDataUrl;

          try {
            const res = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileName: file.name, dataUrl: rawDataUrl }),
            });
            if (res.ok) {
              const data = await res.json();
              finalUrl = data.url;
            }
          } catch (err) {
            console.error('File upload error:', err);
          }

          const photoObj = {
            url: finalUrl,
            title: file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
            type: isVideo ? ('video' as const) : ('photo' as const),
          };

          setSelectedPhotos((prev) => [...prev, photoObj]);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  // Add custom photo URL
  const handleAddCustomPhotoUrl = () => {
    if (!customPhotoUrl.trim()) return;
    const isVideo = customPhotoUrl.endsWith('.mp4') || customPhotoUrl.endsWith('.webm');
    const newPhoto = {
      url: customPhotoUrl.trim(),
      title: isVideo ? 'カスタム動画' : 'カスタム写真',
      type: isVideo ? ('video' as const) : ('photo' as const),
    };
    setSelectedPhotos((prev) => [...prev, newPhoto]);
    setCustomPhotoUrl('');
  };

  // Next step in picker or save photos
  const handlePickerNext = () => {
    if (selectedPhotos.length === 0) return;

    if (pickerTargetAlbumId) {
      // Adding to existing album directly
      const newItems: AlbumMedia[] = selectedPhotos.map((p, idx) => ({
        id: `media-${Date.now()}-${idx}`,
        type: p.type || 'photo',
        url: p.url,
        title: p.title || '写真',
        createdAt: new Date().toISOString(),
      }));

      setAlbums((prev) =>
        prev.map((a) => {
          if (a.id === pickerTargetAlbumId) {
            return {
              ...a,
              items: [...newItems, ...a.items],
              updatedAt: new Date().toISOString(),
            };
          }
          return a;
        })
      );

      setPickerStep('closed');
      setSelectedPhotos([]);
    } else {
      // Go to album name input step
      setPickerStep('album_info');
    }
  };

  // Complete creation of new album
  const handleFinishCreateAlbum = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumName.trim() || selectedPhotos.length === 0) return;

    const newItems: AlbumMedia[] = selectedPhotos.map((p, idx) => ({
      id: `media-${Date.now()}-${idx}`,
      type: p.type || 'photo',
      url: p.url,
      title: p.title || '写真',
      createdAt: new Date().toISOString(),
    }));

    const newAlbum: Album = {
      id: `album-${Date.now()}`,
      name: newAlbumName.trim(),
      items: newItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setAlbums((prev) => [newAlbum, ...prev]);
    setActiveAlbumId(newAlbum.id);
    setPickerStep('closed');
    setSelectedPhotos([]);
    setNewAlbumName('');
  };

  // Delete an album
  const handleDeleteAlbum = (albumId: string) => {
    if (!confirm('このアルバムを削除しますか？アルバム内の写真もすべて削除されます。')) return;
    setAlbums((prev) => prev.filter((a) => a.id !== albumId));
    if (activeAlbumId === albumId) setActiveAlbumId(null);
    setMenuAlbumId(null);
  };

  // Rename an album
  const handleSaveRenameAlbum = (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuAlbumId || !renameInputValue.trim()) return;

    setAlbums((prev) =>
      prev.map((a) => (a.id === menuAlbumId ? { ...a, name: renameInputValue.trim() } : a))
    );
    setIsRenameModalOpen(false);
    setMenuAlbumId(null);
    setRenameInputValue('');
  };

  // Delete individual media from inside album
  const handleDeleteMediaFromAlbum = (albumId: string, mediaId: string) => {
    if (!confirm('この写真をアルバムから削除しますか？')) return;
    setAlbums((prev) =>
      prev.map((a) => {
        if (a.id === albumId) {
          return {
            ...a,
            items: a.items.filter((item) => item.id !== mediaId),
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      })
    );
    setSelectedMediaIndex(null);
  };

  // Render album cover grid (LINE style collage)
  const renderAlbumCover = (items: AlbumMedia[]) => {
    if (!items || items.length === 0) {
      return (
        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
          <ImageIcon className="w-10 h-10" />
        </div>
      );
    }

    if (items.length === 1) {
      return <img src={items[0].url} alt="" className="w-full h-full object-cover" />;
    }

    if (items.length === 2) {
      return (
        <div className="w-full h-full grid grid-cols-2 gap-0.5">
          <img src={items[0].url} alt="" className="w-full h-full object-cover" />
          <img src={items[1].url} alt="" className="w-full h-full object-cover" />
        </div>
      );
    }

    if (items.length === 3) {
      return (
        <div className="w-full h-full grid grid-cols-2 gap-0.5">
          <img src={items[0].url} alt="" className="w-full h-full object-cover" />
          <div className="grid grid-rows-2 gap-0.5">
            <img src={items[1].url} alt="" className="w-full h-full object-cover" />
            <img src={items[2].url} alt="" className="w-full h-full object-cover" />
          </div>
        </div>
      );
    }

    // 4 or more items (2x2 grid)
    return (
      <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5">
        <img src={items[0].url} alt="" className="w-full h-full object-cover" />
        <img src={items[1].url} alt="" className="w-full h-full object-cover" />
        <img src={items[2].url} alt="" className="w-full h-full object-cover" />
        <img src={items[3].url} alt="" className="w-full h-full object-cover" />
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden font-sans relative">
      {/* 1. ALBUM LIST VIEW (Standard LINE Album Grid) */}
      {!activeAlbumId ? (
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="px-4 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-20 flex items-center justify-between shadow-2xs">
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none">アルバム</h1>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                {albums.length}個のアルバム
              </p>
            </div>

            <button
              onClick={handleOpenPickerForNewAlbum}
              className="px-3.5 py-1.5 bg-[#00c300] hover:bg-[#00b000] text-white rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>アルバム作成</span>
            </button>
          </div>

          {/* Albums Cards Grid */}
          <div className="p-2 sm:p-3 flex-1 w-full">
            {albums.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 w-full">
                {albums.map((album) => (
                  <div
                    key={album.id}
                    onClick={() => setActiveAlbumId(album.id)}
                    className="group bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-md transition cursor-pointer flex flex-col relative w-full"
                  >
                    {/* Cover Collage Thumbnail */}
                    <div className="aspect-square bg-slate-100 overflow-hidden relative border-b border-slate-100">
                      {renderAlbumCover(album.items)}

                      {/* Photo Count Badge */}
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold rounded-md">
                        {album.items?.length || 0}枚
                      </div>
                    </div>

                    {/* Album Meta Details */}
                    <div className="p-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-1">
                        <h3 className="font-bold text-xs text-slate-900 truncate leading-snug">
                          {album.name}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(album.updatedAt || album.createdAt).toLocaleDateString('ja-JP')} 更新
                        </p>
                      </div>

                      {/* Menu Option Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuAlbumId(menuAlbumId === album.id ? null : album.id);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer shrink-0"
                        title="操作メニュー"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Dropdown Menu for Album */}
                    {menuAlbumId === album.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-10 right-2 z-30 w-36 bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-xs font-bold text-slate-700 animate-in fade-in zoom-in-95"
                      >
                        <button
                          onClick={() => {
                            setRenameInputValue(album.name);
                            setIsRenameModalOpen(true);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                          <span>名前を変更</span>
                        </button>
                        <button
                          onClick={() => handleDeleteAlbum(album.id)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 text-red-600 flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>アルバムを削除</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center space-y-3.5 my-6">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-[#00c300] flex items-center justify-center">
                  <Images className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">アルバムがまだありません</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    写真を選択して「アルバム作成」をタップすると、大切な思い出をグループでまとめて保存できます。
                  </p>
                </div>
                <button
                  onClick={handleOpenPickerForNewAlbum}
                  className="px-5 py-2.5 bg-[#00c300] hover:bg-[#00b000] text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>最初のアルバムを作成する</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 2. ALBUM DETAIL VIEW (Market LINE Style Photo Grid) */
        activeAlbum && (
          <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Detail Navigation Bar */}
            <div className="px-3 py-3 bg-white border-b border-slate-200 sticky top-0 z-20 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setActiveAlbumId(null)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-700 transition cursor-pointer"
                  title="アルバム一覧へ戻る"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="min-w-0">
                  <h1 className="font-bold text-sm sm:text-base text-slate-900 truncate leading-tight">
                    {activeAlbum.name}
                  </h1>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {activeAlbum.items.length}枚の写真
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleOpenPickerForExistingAlbum(activeAlbum.id)}
                  className="px-3 py-1.5 bg-[#00c300] hover:bg-[#00b000] text-white rounded-full text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>写真追加</span>
                </button>
              </div>
            </div>

            {/* 3-Column Photo Grid */}
            <div className="p-0 flex-1 w-full">
              {activeAlbum.items && activeAlbum.items.length > 0 ? (
                <div className="grid grid-cols-3 gap-0.5 w-full">
                  {activeAlbum.items.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedMediaIndex(idx)}
                      className="group relative aspect-square bg-slate-900 overflow-hidden cursor-pointer rounded-none transition hover:opacity-95 w-full"
                    >
                      {item.type === 'video' ? (
                        <div className="w-full h-full relative bg-black flex items-center justify-center">
                          <video src={item.url} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <div className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center">
                              <Play className="w-4 h-4 ml-0.5 fill-current" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={item.url}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        />
                      )}

                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-end p-1.5 text-white">
                        <span className="text-[10px] font-medium truncate">{item.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 my-8">
                  <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-bold">このアルバムにはまだ写真がありません</p>
                  <button
                    onClick={() => handleOpenPickerForExistingAlbum(activeAlbum.id)}
                    className="px-4 py-2 bg-[#00c300] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                  >
                    写真を追加する
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* 3. STEP 1 & 2 PHOTO PICKER MODAL (LINE Official Photo Picker Experience) */}
      {pickerStep !== 'closed' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
            {/* Picker Header */}
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {pickerStep === 'album_info' && (
                  <button
                    onClick={() => setPickerStep('select_photos')}
                    className="p-1 hover:bg-white/10 rounded-full cursor-pointer text-slate-300"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <h2 className="font-bold text-sm sm:text-base">
                  {pickerStep === 'select_photos'
                    ? pickerTargetAlbumId
                      ? 'アルバムに写真を追加'
                      : '写真を選択'
                    : 'アルバムを作成'}
                </h2>
              </div>

              <button
                onClick={() => setPickerStep('closed')}
                className="p-1.5 hover:bg-white/10 rounded-full text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* STEP 1: SELECT PHOTOS GRID */}
            {pickerStep === 'select_photos' && (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-100">
                {/* Upload & Direct Custom Input Bar */}
                <div className="p-3 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[#00c300] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>端末から写真をまとめて選択 (複数可)</span>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      multiple
                      accept="image/*,video/*"
                      onChange={handleLocalFilesUpload}
                      className="hidden"
                    />
                  </div>

                  {/* URL Input option */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="url"
                      value={customPhotoUrl}
                      onChange={(e) => setCustomPhotoUrl(e.target.value)}
                      placeholder="画像/動画のURLを直接追加..."
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00c300]"
                    />
                    <button
                      onClick={handleAddCustomPhotoUrl}
                      disabled={!customPhotoUrl.trim()}
                      className="px-3 py-1.5 bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      追加
                    </button>
                  </div>
                </div>

                {/* Preset Sample Gallery Photos Grid */}
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">サンプル写真ライブラリ</span>
                    <span className="text-[10px] text-slate-500 font-medium">タップして複数選択</span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {PRESET_SAMPLE_PHOTOS.map((photo) => {
                      const selectedIdx = selectedPhotos.findIndex((p) => p.url === photo.url);
                      const isSelected = selectedIdx !== -1;

                      return (
                        <div
                          key={photo.url}
                          onClick={() => handleTogglePhotoSelection(photo)}
                          className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition select-none group ${
                            isSelected
                              ? 'border-[#00c300] ring-2 ring-[#00c300]/30 scale-[0.98]'
                              : 'border-transparent hover:border-slate-300'
                          }`}
                        >
                          <img
                            src={photo.url}
                            alt={photo.title}
                            className="w-full h-full object-cover"
                          />

                          {/* Selection Badge Number (1, 2, 3...) like Market LINE */}
                          <div
                            className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs transition shadow-md ${
                              isSelected
                                ? 'bg-[#00c300] text-white scale-110'
                                : 'bg-black/40 border border-white/60 text-white hover:bg-black/60'
                            }`}
                          >
                            {isSelected ? selectedIdx + 1 : ''}
                          </div>

                          <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/70 to-transparent text-[9px] text-white font-medium truncate">
                            {photo.title}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Sticky Action Bar */}
                <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 shadow-lg">
                  <div className="text-xs font-bold text-slate-800">
                    選択中: <span className="text-[#00c300] font-black text-sm">{selectedPhotos.length}</span> 枚
                  </div>

                  <button
                    onClick={handlePickerNext}
                    disabled={selectedPhotos.length === 0}
                    className="px-6 py-2.5 bg-[#00c300] hover:bg-[#00b000] disabled:opacity-40 text-white font-bold text-xs rounded-full transition shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95"
                  >
                    <span>次へ</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: ALBUM NAME INPUT & PREVIEW */}
            {pickerStep === 'album_info' && (
              <form onSubmit={handleFinishCreateAlbum} className="p-4 space-y-4 flex-1 overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    アルバム名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newAlbumName}
                    onChange={(e) => setNewAlbumName(e.target.value)}
                    placeholder="例: 2026.07.30のアルバム / 家族旅行"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-[#00c300] rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00c300]/20"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">
                      選択した写真 ({selectedPhotos.length}枚)
                    </span>
                  </div>

                  {/* Selected Photos Carousel Preview */}
                  <div className="grid grid-cols-4 gap-2 bg-slate-100 p-2.5 rounded-2xl max-h-48 overflow-y-auto">
                    {selectedPhotos.map((photo, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-900">
                        <img src={photo.url} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleTogglePhotoSelection(photo)}
                          className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full text-white hover:bg-rose-600 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!newAlbumName.trim() || selectedPhotos.length === 0}
                    className="w-full py-3 bg-[#00c300] hover:bg-[#00b000] disabled:opacity-40 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-md cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                  >
                    <Check className="w-4 h-4" />
                    <span>アルバムを作成して保存</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 4. RENAME ALBUM MODAL */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <h3 className="font-bold text-sm text-slate-900">アルバム名の変更</h3>
            <form onSubmit={handleSaveRenameAlbum} className="space-y-3">
              <input
                type="text"
                required
                value={renameInputValue}
                onChange={(e) => setRenameInputValue(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00c300]"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00c300] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. LIGHTBOX / FULLSCREEN MEDIA VIEWER FOR ALBUMS */}
      {selectedMediaIndex !== null && activeAlbum && activeAlbum.items[selectedMediaIndex] && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between select-none animate-in fade-in duration-200">
          {/* Top Bar */}
          <div className="p-4 flex items-center justify-between text-white bg-gradient-to-b from-black/80 to-transparent z-20">
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold">
              {selectedMediaIndex + 1} / {activeAlbum.items.length}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  handleDeleteMediaFromAlbum(activeAlbum.id, activeAlbum.items[selectedMediaIndex].id)
                }
                className="p-2.5 rounded-full bg-white/10 hover:bg-rose-600 text-white transition cursor-pointer"
                title="アルバムから削除"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setSelectedMediaIndex(null)}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="閉じる"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Center Stage */}
          <div className="flex-1 relative flex items-center justify-center p-0 w-full">
            {selectedMediaIndex > 0 && (
              <button
                onClick={() => setSelectedMediaIndex(selectedMediaIndex - 1)}
                className="absolute left-2 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white z-30 transition cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img
              src={activeAlbum.items[selectedMediaIndex].url}
              alt=""
              className="max-h-[85vh] w-full object-contain shadow-2xl"
            />

            {selectedMediaIndex < activeAlbum.items.length - 1 && (
              <button
                onClick={() => setSelectedMediaIndex(selectedMediaIndex + 1)}
                className="absolute right-2 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white z-30 transition cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Title Bar */}
          <div className="p-4 bg-gradient-to-t from-black/90 to-transparent text-center text-white z-20">
            <p className="text-xs font-bold">
              {activeAlbum.items[selectedMediaIndex].title || activeAlbum.name}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

