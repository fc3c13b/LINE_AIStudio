import React, { useState, useCallback, useRef } from 'react';
import { RotateCcw, Lightbulb, Undo2, Trophy, ArrowLeft } from 'lucide-react';

type Suit = 'S' | 'H' | 'D' | 'C';
interface Card { id: string; suit: Suit; rank: number; faceUp: boolean; }
interface GS { stock: Card[]; waste: Card[]; foundations: Card[][]; tableau: Card[][]; }
type Sel = { src: 'waste' | 'tableau' | 'foundation'; ci?: number; ri?: number; cards: Card[]; } | null;
type BtnId = 'undo' | 'hint' | 'restart';

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const SYM: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RNKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const isRed = (s: Suit) => s === 'H' || s === 'D';

// 裏面デザイン選択
type CardDesign = 'blue' | 'red' | 'dark' | 'green';
const DESIGNS: { id: CardDesign; label: string; bg: string; dot: string }[] = [
  { id: 'blue',  label: '青', bg: 'linear-gradient(135deg,#1565c0,#0d47a1)', dot: '#1e88e5' },
  { id: 'red',   label: '赤', bg: 'linear-gradient(135deg,#c62828,#7f0000)', dot: '#e53935' },
  { id: 'dark',  label: '黒', bg: 'linear-gradient(135deg,#263238,#37474f)', dot: '#455a64' },
  { id: 'green', label: '緑', bg: 'linear-gradient(135deg,#1b5e20,#2e7d32)', dot: '#43a047' },
];

// 隠し操作: やり直す → ヒント → 1枚戻す の順に2秒以内に押すとLINEへ切り替わる
const SECRET: BtnId[] = ['restart', 'hint', 'undo'];
const CW = 46, CH = 64;

function mkDeck(): Card[] {
  return SUITS.flatMap(suit =>
    Array.from({ length: 13 }, (_, i) => ({ id: `${suit}${i + 1}`, suit, rank: i + 1, faceUp: false }))
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal(): GS {
  const deck = shuffle(mkDeck());
  const tableau: Card[][] = [];
  let idx = 0;
  for (let c = 0; c < 7; c++) {
    tableau.push(deck.slice(idx, idx + c + 1).map((card, j) => ({ ...card, faceUp: j === c })));
    idx += c + 1;
  }
  return { stock: deck.slice(idx), waste: [], foundations: [[], [], [], []], tableau };
}

function canFoundation(card: Card, f: Card[]): boolean {
  return f.length === 0
    ? card.rank === 1
    : f[f.length - 1].suit === card.suit && card.rank === f[f.length - 1].rank + 1;
}

function canTableau(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return card.rank === 13;
  const top = pile[pile.length - 1];
  return top.faceUp && isRed(card.suit) !== isRed(top.suit) && card.rank === top.rank - 1;
}

function flipTops(gs: GS): GS {
  return {
    ...gs,
    tableau: gs.tableau.map(col =>
      col.length > 0 && !col[col.length - 1].faceUp
        ? [...col.slice(0, -1), { ...col[col.length - 1], faceUp: true }]
        : col
    ),
  };
}

const btnStyle: React.CSSProperties = {
  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
  gap: 4, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 600,
  WebkitTapHighlightColor: 'transparent',
};

export const SolitaireGame: React.FC<{ onSecretCode: () => void; onClose?: () => void }> = ({ onSecretCode, onClose }) => {
  const [gs, setGs] = useState<GS>(deal);
  const [hist, setHist] = useState<GS[]>([]);
  const [sel, setSel] = useState<Sel>(null);
  const [hintId, setHintId] = useState<string | null>(null);
  const [won, setWon] = useState(false);
  const [cardDesign, setCardDesign] = useState<CardDesign>(
    () => (localStorage.getItem('solitaire_design') as CardDesign) || 'blue'
  );
  const handleDesignChange = (d: CardDesign) => {
    setCardDesign(d);
    localStorage.setItem('solitaire_design', d);
  };
  const seqRef = useRef<BtnId[]>([]);
  const tmRef = useRef<ReturnType<typeof setTimeout>>();

  const clone = (g: GS): GS => JSON.parse(JSON.stringify(g));

  const commit = useCallback((g: GS) => {
    const next = flipTops(g);
    setGs(next); setSel(null); setHintId(null);
    setWon(next.foundations.every(f => f.length === 13));
  }, []);

  const saveHist = useCallback((g: GS) => setHist(h => [...h.slice(-30), g]), []);

  const trackBtn = useCallback((btn: BtnId) => {
    const seq = [...seqRef.current, btn];
    seqRef.current = seq;
    clearTimeout(tmRef.current);
    if (seq.length >= SECRET.length) {
      const tail = seq.slice(-SECRET.length);
      if (tail.every((b, i) => b === SECRET[i])) {
        seqRef.current = [];
        onSecretCode();
        return;
      }
    }
    tmRef.current = setTimeout(() => { seqRef.current = []; }, 2000);
  }, [onSecretCode]);

  const applyMove = useCallback((curGs: GS, s: Sel, destFn: (g: GS) => void) => {
    if (!s) return;
    saveHist(curGs);
    const ng = clone(curGs);
    if (s.src === 'waste') ng.waste.pop();
    else if (s.src === 'tableau' && s.ci !== undefined && s.ri !== undefined)
      ng.tableau[s.ci] = ng.tableau[s.ci].slice(0, s.ri);
    else if (s.src === 'foundation' && s.ci !== undefined)
      ng.foundations[s.ci].pop();
    destFn(ng);
    commit(ng);
  }, [saveHist, commit]);

  const onStock = useCallback(() => {
    setSel(null); setHintId(null); saveHist(gs);
    setGs(g => g.stock.length === 0
      ? { ...g, stock: [...g.waste].reverse().map(c => ({ ...c, faceUp: false })), waste: [] }
      : { ...g, stock: g.stock.slice(0, -1), waste: [...g.waste, { ...g.stock[g.stock.length - 1], faceUp: true }] }
    );
  }, [gs, saveHist]);

  const onWaste = useCallback(() => {
    if (!gs.waste.length) return;
    if (sel?.src === 'waste') { setSel(null); return; }
    setSel({ src: 'waste', cards: [gs.waste[gs.waste.length - 1]] });
    setHintId(null);
  }, [gs.waste, sel]);

  const onFoundation = useCallback((fi: number) => {
    if (sel) {
      if (sel.cards.length === 1 && canFoundation(sel.cards[0], gs.foundations[fi])) {
        applyMove(gs, sel, ng => ng.foundations[fi].push({ ...sel!.cards[0], faceUp: true }));
      } else setSel(null);
    } else {
      const f = gs.foundations[fi];
      if (f.length) { setSel({ src: 'foundation', ci: fi, cards: [f[f.length - 1]] }); setHintId(null); }
    }
  }, [sel, gs, applyMove]);

  const onCard = useCallback((ci: number, ri: number) => {
    const col = gs.tableau[ci];
    const card = col[ri];
    if (!card.faceUp) return;
    if (sel) {
      if (canTableau(sel.cards[0], col)) {
        applyMove(gs, sel, ng => ng.tableau[ci].push(...sel!.cards.map(c => ({ ...c, faceUp: true }))));
        return;
      }
    }
    setSel({ src: 'tableau', ci, ri, cards: col.slice(ri) });
    setHintId(null);
  }, [gs, sel, applyMove]);

  const onEmptyCol = useCallback((ci: number) => {
    if (sel && gs.tableau[ci].length === 0 && canTableau(sel.cards[0], [])) {
      applyMove(gs, sel, ng => ng.tableau[ci].push(...sel!.cards.map(c => ({ ...c, faceUp: true }))));
    } else setSel(null);
  }, [sel, gs, applyMove]);

  const doUndo = useCallback(() => {
    trackBtn('undo');
    if (!hist.length) return;
    setGs(hist[hist.length - 1]); setHist(h => h.slice(0, -1));
    setSel(null); setHintId(null); setWon(false);
  }, [hist, trackBtn]);

  const doHint = useCallback(() => {
    trackBtn('hint'); setSel(null);
    const g = gs;
    if (g.waste.length) {
      const c = g.waste[g.waste.length - 1];
      const fi = SUITS.indexOf(c.suit);
      if (canFoundation(c, g.foundations[fi])) { setHintId(c.id); return; }
      if (g.tableau.some(col => canTableau(c, col))) { setHintId(c.id); return; }
    }
    for (const col of g.tableau) {
      for (let i = 0; i < col.length; i++) {
        if (!col[i].faceUp) continue;
        const c = col[i];
        if (i === col.length - 1 && canFoundation(c, g.foundations[SUITS.indexOf(c.suit)])) { setHintId(c.id); return; }
        if (g.tableau.some(col2 => col2 !== col && canTableau(c, col2))) { setHintId(c.id); return; }
      }
    }
    setHintId('__stock__');
  }, [gs, trackBtn]);

  const doRestart = useCallback(() => {
    trackBtn('restart');
    setGs(deal()); setHist([]); setSel(null); setHintId(null); setWon(false);
  }, [trackBtn]);

  const renderCard = (card: Card, onClick: () => void, extra: React.CSSProperties = {}) => {
    const isSelected = !!sel?.cards.some(c => c.id === card.id);
    const isHinted = hintId === card.id;
    if (!card.faceUp) return (
      <div key={card.id} onClick={onClick} style={{
        width: CW, height: CH, borderRadius: 6, cursor: 'pointer', flexShrink: 0,
        background: DESIGNS.find(d => d.id === cardDesign)!.bg,
        border: '2px solid rgba(255,255,255,0.25)', ...extra,
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: 5,
          backgroundImage: 'repeating-linear-gradient(45deg,rgba(255,255,255,0.07) 0px,rgba(255,255,255,0.07) 2px,transparent 2px,transparent 10px)',
        }} />
      </div>
    );
    const red = isRed(card.suit);
    return (
      <div key={card.id} onClick={onClick} style={{
        width: CW, height: CH, borderRadius: 6, cursor: 'pointer', flexShrink: 0,
        background: '#fffef8',
        border: `2px solid ${isSelected ? '#ffd700' : isHinted ? '#00e676' : '#ccc'}`,
        boxShadow: isSelected ? '0 0 8px #ffd700' : isHinted ? '0 0 8px #00e676' : '0 1px 3px rgba(0,0,0,.25)',
        color: red ? '#c62828' : '#1a1a1a',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '2px 3px', fontSize: 11, fontWeight: 700, lineHeight: 1.2,
        userSelect: 'none', ...extra,
      }}>
        <div>{RNKS[card.rank]}<br />{SYM[card.suit]}</div>
        <div style={{ fontSize: 20, textAlign: 'center', lineHeight: 1 }}>{SYM[card.suit]}</div>
        <div style={{ transform: 'rotate(180deg)' }}>{RNKS[card.rank]}<br />{SYM[card.suit]}</div>
      </div>
    );
  };

  const renderCol = (col: Card[], ci: number) => {
    const offsets: number[] = [];
    let top = 0;
    for (const card of col) { offsets.push(top); top += card.faceUp ? 22 : 14; }
    const colH = col.length === 0 ? CH : offsets[offsets.length - 1] + CH;
    return (
      <div key={ci} style={{ flex: 1, position: 'relative', height: colH, minHeight: CH }}
        onClick={() => col.length === 0 && onEmptyCol(ci)}>
        {col.length === 0 && (
          <div style={{ width: CW, height: CH, borderRadius: 6, border: '2px dashed rgba(255,255,255,0.25)', position: 'absolute' }} />
        )}
        {col.map((card, ri) => (
          <div key={card.id} style={{ position: 'absolute', top: offsets[ri], left: 0, zIndex: ri }}>
            {renderCard(card, () => onCard(ci, ri))}
          </div>
        ))}
      </div>
    );
  };

  const score = gs.foundations.reduce((s, f) => s + f.length, 0) * 10;

  return (
    <div style={{
      flex: 1, minHeight: 0,
      width: '100%',
      background: 'linear-gradient(160deg,#1b5e20 0%,#2e7d32 60%,#1b5e20 100%)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
    }}>
      {/* タイトルバー */}
      <div style={{ padding: '10px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {onClose && (
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#fff',
            padding: '2px 4px 2px 0', display: 'flex', alignItems: 'center',
          }}>
            <ArrowLeft size={22} />
          </button>
        )}
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>♠ ソリティア</span>
        <div style={{ flex: 1 }} />
        {/* 裏面デザイン選択 */}
        {DESIGNS.map(d => (
          <button key={d.id} onClick={() => handleDesignChange(d.id)} title={d.label} style={{
            width: 18, height: 18, borderRadius: '50%', background: d.dot, padding: 0,
            border: `2px solid ${cardDesign === d.id ? '#fff' : 'rgba(255,255,255,0.3)'}`,
            cursor: 'pointer', flexShrink: 0,
            transform: cardDesign === d.id ? 'scale(1.2)' : 'scale(1)',
            transition: 'transform 0.15s',
          }} />
        ))}
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 6 }}>スコア: {score}</span>
      </div>

      {/* 山札・捨て札・ファンデーション */}
      <div style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* 山札 */}
        <div onClick={onStock} style={{
          width: CW, height: CH, borderRadius: 6, cursor: 'pointer', flexShrink: 0,
          ...(gs.stock.length > 0
            ? { background: 'linear-gradient(135deg,#1565c0,#0d47a1)', border: '2px solid rgba(255,255,255,0.25)' }
            : { border: '2px dashed rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }),
        }}>
          {gs.stock.length === 0
            ? <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 22 }}>↺</span>
            : <div style={{
                width: '100%', height: '100%', borderRadius: 5,
                backgroundImage: 'repeating-linear-gradient(45deg,rgba(255,255,255,0.07) 0px,rgba(255,255,255,0.07) 2px,transparent 2px,transparent 10px)',
              }} />}
        </div>

        {/* 捨て札 */}
        <div style={{ width: CW, height: CH, flexShrink: 0 }}>
          {gs.waste.length === 0
            ? <div style={{ width: CW, height: CH, borderRadius: 6, border: '2px dashed rgba(255,255,255,0.25)' }} />
            : renderCard(gs.waste[gs.waste.length - 1], onWaste)}
        </div>

        <div style={{ flex: 1 }} />

        {/* ファンデーション ♠♥♦♣ */}
        {SUITS.map((suit, fi) => {
          const f = gs.foundations[fi];
          const canDrop = sel?.cards.length === 1 && canFoundation(sel.cards[0], f);
          return (
            <div key={suit} onClick={() => onFoundation(fi)} style={{
              width: CW, height: CH, borderRadius: 6, cursor: 'pointer', flexShrink: 0,
              border: `2px solid ${canDrop ? '#ffd700' : 'rgba(255,255,255,0.3)'}`,
              background: 'rgba(0,0,0,0.15)', position: 'relative', overflow: 'hidden',
            }}>
              {f.length === 0
                ? <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%',
                    color: isRed(suit) ? 'rgba(200,80,80,0.45)' : 'rgba(255,255,255,0.25)', fontSize: 22, fontWeight: 700,
                  }}>{SYM[suit]}</div>
                : renderCard(f[f.length - 1], () => onFoundation(fi), { position: 'absolute', top: 0, left: 0 })}
            </div>
          );
        })}
      </div>

      {/* タブロー */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 5px 8px', display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        {gs.tableau.map((col, ci) => renderCol(col, ci))}
      </div>

      {/* クリア画面 */}
      {won && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <Trophy style={{ color: '#ffd700', width: 64, height: 64, marginBottom: 12 }} />
          <div style={{ color: '#fff', fontSize: 30, fontWeight: 800 }}>クリア！</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 6 }}>スコア: {score}</div>
          <button onClick={doRestart} style={{
            marginTop: 28, padding: '12px 36px', borderRadius: 14,
            background: '#43a047', color: '#fff', fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer',
          }}>もう一度プレイ</button>
        </div>
      )}

      {/* ボタンバー: やり直す→ヒント→1枚戻す の順2秒以内でLINEへ */}
      <div style={{ padding: '8px 10px 20px', background: 'rgba(0,0,0,0.3)', display: 'flex', gap: 8 }}>
        <button onClick={doRestart} style={btnStyle}>
          <RotateCcw size={20} />
          <span style={{ fontSize: 10 }}>最初から</span>
        </button>
        <button onClick={doHint} style={{ ...btnStyle, background: hintId ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.12)' }}>
          <Lightbulb size={20} />
          <span style={{ fontSize: 10 }}>ヒント</span>
        </button>
        <button onClick={doUndo} style={{ ...btnStyle, opacity: hist.length ? 1 : 0.4 }}>
          <Undo2 size={20} />
          <span style={{ fontSize: 10 }}>1枚戻す</span>
        </button>
      </div>
    </div>
  );
};
