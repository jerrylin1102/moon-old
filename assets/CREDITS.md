# 素材授權

3D 場景全部由 three.js 內建幾何體程序生成，沒有使用任何外部模型。

**音效與環境音全部是 WebAudio 程序生成**（`apps/web/src/audio/`），零外部音檔、零授權風險：
擲筊落地、批示結果、顯靈、牽紅線、偷吃供品都是振盪器與濾波噪音即時合成；
環境層是香爐嗡鳴 drone、隨機遠鐘／木魚、疲勞噪音層。

**背景音樂是外部音檔**（`apps/web/public/audio/bgm-temple.mp3`），下載前已查證授權，登記如下：

| 檔名 | 用途 | 來源 URL | 授權 | 作者 | 需標註 |
| ---- | ---- | -------- | ---- | ---- | ------ |
| `bgm-temple.mp3` | 值班中背景音樂 | https://pixabay.com/music/classical-string-quartet-asian-asian-china-chinese-music-501705/ | Pixabay Content License（免費商用） | NastelBom | 否 |

## 可用來源

- **Pixabay Music / Sound Effects** — Pixabay License，可商用、免標註。優先找這裡
- **Freesound** — 需篩 CC0；CC-BY 的要標註
- **OpenGameArt** — 需篩 CC0
- **Free Music Archive** — 需篩 CC0 / CC-BY
- **Musopen** — 公共領域古典錄音（古箏、笛）
- **Incompetech (Kevin MacLeod)** — CC-BY，可用但**必須標註**

## 零授權風險的底層

環境音的第一層用 WebAudio 程序生成（低頻 drone + 隨機鐘聲 + 濾波噪音當風聲），
不需要任何外部音檔。外部音樂是加分項，找不到滿意的也不擋上線。
