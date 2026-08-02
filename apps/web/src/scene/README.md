# scene/ 檔案架構原則

- 一個場景物件一個檔案（`temple/Censer.tsx`、`temple/Pillars.tsx`……），檔案只管「這個物件長什麼樣、怎麼動」。改外觀只需要動一個檔案。
- 純數字常數（尺寸、位置）留在 `layout.ts`，不要散落在元件裡。
- 效能敏感的批次渲染（NPC、粒子）只能拆邏輯／拆檔案，不能拆 draw call——`worshipper/` 底下多個 NPC 仍共用同一組 `InstancedMesh`，不要因為想要「一個物件一個元件」就把每個 NPC 拆成獨立 `<mesh>`，那樣會讓 draw call 隨玩家人數線性增加。
- `temple/`：靜態建築（牆、柱、桌、香爐、蠟燭、吊燈……），一次擺好或用固定張數的 InstancedMesh。
- `worshipper/`：NPC 相關的渲染邏輯（姿勢計算、互動事件、mesh 宣告），仍然是「固定 SLOTS 張 InstancedMesh」架構。
- `effects/`：特效（煙、灰、愛心粒子……），同樣走「固定粒子數、生命週期到了就重生」的 pattern，不要無上限生成。
