import type { Wish } from '@moon/shared';

/** 贊助作者的彩蛋信眾。不放進資料庫題庫，也不算進一般抽選池，獨立的固定內容 */
export const SUPPORT_WISH_ID = 'support-author';

export const SUPPORT_WISH: Wish = {
  id: SUPPORT_WISH_ID,
  category: 'absurd',
  // domain 給 yuelao：准了就是正常受理，不會被當成「越權辦事」多扣印象分
  domain: 'yuelao',
  text: '月老我啊，其實是背後一個寫程式寫到頭髮都白了的凡人。這間廟能讓你玩得開心，就是我最大的功德了。如果你剛好喜歡這個遊戲，想請我喝杯飲料，我會很開心；不想的話，直接跟我說「駁」就好，不會少一根香。',
  intensity: 1,
  tags: ['support'],
  resolutions: {
    approve: '「謝謝你，月老。」他說完就走了，像是真的許成了一個願望。',
    reject: '他愣了一下，隨即笑了笑：「也是，月老哪有在管這個的。」轉身走了。',
    transfer: '他歪頭想了想：「這種事……要轉去哪個部門啊？」自己也笑了，走了。',
  },
  source: 'support',
};
