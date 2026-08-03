import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { apiUrl } from '../services/api';

export interface SmbItem { name: string; path: string; isAudio: boolean; isDir: boolean; ext: string; }

interface MusicCtx {
  musicExpanded: boolean; setMusicExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  currentDir: string; dirHistory: string[]; musicItems: SmbItem[];
  musicLoading: boolean; musicError: string;
  playlist: SmbItem[]; playlistIdx: number; currentTrack: SmbItem | null;
  isPlaying: boolean;
  isShuffle: boolean; setIsShuffle: React.Dispatch<React.SetStateAction<boolean>>;
  isLoop: boolean; setIsLoop: React.Dispatch<React.SetStateAction<boolean>>;
  browseDir: (dir: string) => Promise<void>;
  handleBrowseDir: (dir: string) => void; handleDirBack: () => void;
  handlePlayTrack: (item: SmbItem) => void; handlePlayPause: () => void;
  handleNext: () => void; handlePrev: () => void;
}
const MusicPlayerContext = createContext<MusicCtx | null>(null);
export const useMusicPlayer = () => { const ctx = useContext(MusicPlayerContext); if (!ctx) throw new Error('no provider'); return ctx; };

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const saveRef = useRef<ReturnType<typeof setTimeout>>();
  const audioRef = useRef<HTMLAudioElement>(null);
  const ld = (k: string, fb: any) => { try { return (JSON.parse(localStorage.getItem('music_state')||'{}'))[k]??fb; } catch { return fb; } };
  const [musicExpanded, setMusicExpanded] = useState(()=>ld('musicExpanded',false));
  const [currentDir, setCurrentDir] = useState(()=>ld('currentDir',''));
  const [dirHistory, setDirHistory] = useState(()=>ld('dirHistory',[]));
  const [musicItems, setMusicItems] = useState(()=>ld('musicItems',[]));
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState('');
  const [playlist, setPlaylist] = useState(()=>ld('playlist',[]));
  const [playlistIdx, setPlaylistIdx] = useState(()=>ld('playlistIdx',-1));
  const [currentTrack, setCurrentTrack] = useState(()=>ld('currentTrack',null));
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(()=>ld('isShuffle',false));
  const [isLoop, setIsLoop] = useState(()=>ld('isLoop',false));
  const plRef = useRef<any[]>([]); useEffect(()=>{plRef.current=playlist;},[playlist]);
  const plIdxRef = useRef(-1); useEffect(()=>{plIdxRef.current=playlistIdx;},[playlistIdx]);
  const shuffleRef = useRef(false); useEffect(()=>{shuffleRef.current=isShuffle;},[isShuffle]);
  const loopRef = useRef(false); useEffect(()=>{loopRef.current=isLoop;},[isLoop]);
  const playingRef = useRef(false); useEffect(()=>{playingRef.current=isPlaying;},[isPlaying]);
  const trackRef = useRef<any>(null); useEffect(()=>{trackRef.current=currentTrack;},[currentTrack]);
  const dirRef = useRef(''); useEffect(()=>{dirRef.current=currentDir;},[currentDir]);
  const browseDir = useCallback(async(dir:string)=>{ setMusicLoading(true); setMusicError(''); try { const r=await fetch(apiUrl('/api/music/browse?path='+encodeURIComponent(dir))); const d=await r.json(); if(d.success){setMusicItems(d.items);setCurrentDir(dir);setPlaylist(d.items.filter((i:any)=>i.isAudio));}else setMusicError(d.error||'エラー'); } catch(e:any){setMusicError(e.message||'接続失敗');} finally{setMusicLoading(false);}}, []);
  const handleBrowseDir = useCallback((dir:string)=>{setDirHistory(h=>[...h,dirRef.current]);browseDir(dir);},[browseDir]);
  const handleDirBack = useCallback(()=>{setDirHistory(h=>{const p=[...h];const t=p.pop()??'';browseDir(t);return p;});},[browseDir]);
  const playTrackAt = useCallback((item:any,idx:number)=>{ setCurrentTrack(item); setPlaylistIdx(idx); if(audioRef.current){audioRef.current.src=apiUrl('/api/music/stream?path='+encodeURIComponent(item.path));audioRef.current.play().then(()=>setIsPlaying(true)).catch(()=>setIsPlaying(false));} },[]);
  const handlePlayTrack = useCallback((item:any)=>{ const idx=plRef.current.findIndex((p:any)=>p.path===item.path); playTrackAt(item,idx>=0?idx:0); },[playTrackAt]);
  const handlePlayPause = useCallback(()=>{ if(!trackRef.current){if(plRef.current.length>0)playTrackAt(plRef.current[0],0);return;} if(!audioRef.current)return; if(playingRef.current){audioRef.current.pause();setIsPlaying(false);}else{audioRef.current.play().then(()=>setIsPlaying(true)).catch(()=>setIsPlaying(false));} },[playTrackAt]);
  const handleNext = useCallback(()=>{ if(!plRef.current.length)return; const idx=shuffleRef.current?Math.floor(Math.random()*plRef.current.length):(plIdxRef.current+1)%plRef.current.length; playTrackAt(plRef.current[idx],idx); },[playTrackAt]);
  const handlePrev = useCallback(()=>{ if(!plRef.current.length)return; const idx=plIdxRef.current<=0?plRef.current.length-1:plIdxRef.current-1; playTrackAt(plRef.current[idx],idx); },[playTrackAt]);
  const handleTrackEnded = useCallback(()=>{ if(loopRef.current&&audioRef.current){audioRef.current.currentTime=0;audioRef.current.play().catch(()=>setIsPlaying(false));}else handleNext(); },[handleNext]);
  useEffect(()=>{ if(musicExpanded&&musicItems.length===0&&!musicLoading&&!musicError)browseDir(''); },[musicExpanded]);
  useEffect(()=>{ clearTimeout(saveRef.current); saveRef.current=setTimeout(()=>{ try{localStorage.setItem('music_state',JSON.stringify({currentTrack,playlist,playlistIdx,currentDir,musicItems,isShuffle,isLoop,musicExpanded,dirHistory}));}catch{} },1000); return()=>clearTimeout(saveRef.current); },[currentTrack,playlist,playlistIdx,currentDir,musicItems,isShuffle,isLoop,musicExpanded,dirHistory]);
  useEffect(()=>{ if(currentTrack&&audioRef.current&&!audioRef.current.src) audioRef.current.src=apiUrl('/api/music/stream?path='+encodeURIComponent((currentTrack as any).path)); },[]);
  const value:MusicCtx={musicExpanded,setMusicExpanded,currentDir,dirHistory,musicItems,musicLoading,musicError,playlist,playlistIdx,currentTrack,isPlaying,isShuffle,setIsShuffle,isLoop,setIsLoop,browseDir,handleBrowseDir,handleDirBack,handlePlayTrack,handlePlayPause,handleNext,handlePrev};
  return <MusicPlayerContext.Provider value={value}>{children}<audio ref={audioRef} onEnded={handleTrackEnded} style={{display:'none'}} /></MusicPlayerContext.Provider>;
}
