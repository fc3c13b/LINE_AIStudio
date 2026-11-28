import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Android 15+ Edge-to-Edge 対策:
// 100vh = ステータスバー+ナビバー込みの物理画面全体になるため、
// 起動時に visualViewport.height（inset 適用後の正しい表示領域）を測定して記録し、
// 復帰時はその正しい値を再適用する。
// （背面/ロックからの復帰直後は inset 未適用の膨張した値が返るため、再測定しない）
function measureHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}
function setAppHeight(h: number): void {
  document.documentElement.style.setProperty('--app-height', `${h}px`);
}

// 起動時の正しい値を記録
let goodHeight = measureHeight();
setAppHeight(goodHeight);

// 起動直後に resize が来たら、より小さい値（inset 適用済みの正解）に収束させる
window.visualViewport?.addEventListener('resize', () => {
  if (document.visibilityState !== 'visible') { setAppHeight(goodHeight); return; }
  const h = measureHeight();
  // 膨張値（大きい値）は無視し、正解の小さい値のみ採用
  if (h < goodHeight) goodHeight = h;
  setAppHeight(goodHeight);
});

// 復帰時は記録済みの正しい値を再適用（再測定しない）
function reapply(): void {
  setAppHeight(goodHeight);
  requestAnimationFrame(() => setAppHeight(goodHeight));
  setTimeout(() => setAppHeight(goodHeight), 300);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') reapply();
});
document.addEventListener('resume', reapply);

// 画面回転時のみ測り直す
window.addEventListener('orientationchange', () => {
  setTimeout(() => { goodHeight = measureHeight(); setAppHeight(goodHeight); }, 300);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
