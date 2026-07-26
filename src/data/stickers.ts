import { Sticker } from '../types';

export const STICKER_SETS: { category: string; icon: string; stickers: Sticker[] }[] = [
  {
    category: 'ブラウン & コニー',
    icon: '🐻',
    stickers: [
      { id: 'b1', category: 'ブラウン & コニー', name: 'OK', emoji: '👍', imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80' },
      { id: 'b2', category: 'ブラウン & コニー', name: 'ありがとう', emoji: '🙏', imageUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80' },
      { id: 'b3', category: 'ブラウン & コニー', name: 'お疲れ様', emoji: '☕', imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80' },
      { id: 'b4', category: 'ブラウン & コニー', name: 'ラブラブ', emoji: '❤️', imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80' },
      { id: 'b5', category: 'ブラウン & コニー', name: 'びっくり', emoji: '😱', imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
      { id: 'b6', category: 'ブラウン & コニー', name: 'ごめんなさい', emoji: '🙇‍♂️', imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' }
    ]
  },
  {
    category: 'リアクション絵文字',
    icon: '😊',
    stickers: [
      { id: 'e1', category: 'リアクション絵文字', name: 'イイね！', emoji: '🎉', imageUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80' },
      { id: 'e2', category: 'リアクション絵文字', name: 'ハート', emoji: '💖', imageUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80' },
      { id: 'e3', category: 'リアクション絵文字', name: '了解！', emoji: '👌', imageUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80' },
      { id: 'e4', category: 'リアクション絵文字', name: '泣き', emoji: '😭', imageUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80' },
      { id: 'e5', category: 'リアクション絵文字', name: 'わくわく', emoji: '✨', imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80' },
      { id: 'e6', category: 'リアクション絵文字', name: 'ひらめき', emoji: '💡', imageUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80' }
    ]
  }
];
