# F2 冒烟测试 URL 清单

> 保存时间：2026-05-22 | 来源：F2 真端到端冒烟测试

## Bilibili

| # | URL | 备注 |
|---|-----|------|
| 1 | `https://www.bilibili.com/video/BV1qA5j6jEJC/?spm_id_from=333.1007.tianma.6-2-20.click&vd_source=d0c732f14ae6900c501b38a4d1c34b7d` | 短视频，带双追踪参数，验 F1.7 规整 |
| 2 | `https://www.bilibili.com/video/BV1u44y1L7Vj` | 31s 有声视频 "21年省体的夜" |
| 3 | `https://www.bilibili.com/video/BV1kP4y1j7xH` | 长视频 "稀有盲盒" |
| — | `https://www.bilibili.com/video/BV1GJ411x7h7` | Rick Astley MV 测试 |
| — | `https://www.bilibili.com/video/BV1mZ9rBAEV1` | Image2 模型介绍 |

## YouTube（需代理 127.0.0.1:7890）

| # | URL | 备注 |
|---|-----|------|
| 4 | `https://www.youtube.com/watch?v=fl1DSmwQKKY` | Claude Code 介绍，普通视频 |
| 5 | `https://www.youtube.com/shorts/ERnYWR0OLKg` | 6s 猫打哈欠 Shorts |

## 小红书

| # | URL | 备注 |
|---|-----|------|
| 6-m | `http://xhslink.com/o/6ADdwOBRd4R` | 手机分享链（可用） |
| 6-d | `https://www.xiaohongshu.com/discovery/item/6a093a8a000000000702fbfe` | 桌面链（被反爬） |
| 6-note | Obsidian Canvas 难用？我给它加了个整理层 | 图文笔记，text 管道 |

## 抖音（需 cookies）

| # | URL | 备注 |
|---|-----|------|
| 7 | `https://v.douyin.com/iJvcK8CLC_o/` | Codex 零基础攻略，需 cookies |

## 微信公众号

| # | URL | 备注 |
|---|-----|------|
| 8 | `https://mp.weixin.qq.com/s/BSroSYpckb6OSc5_ZtWdng` | text 管道，AI 编程工具新闻 |

## 本地测试文件

| # | 路径 | 备注 |
|---|------|------|
| 9 | `data/workspaces/default_project/videos/21年省体的夜-BV1u44y1L7Vj.mp4` | 31s 有声 .mp4 |
| 10 | `data/workspaces/default_project/videos/test_f2_10_audio.mp3` | 提取自 #9 的 .mp3 |

---

## 2026-05-24 Phase R 端到端冒烟

| # | URL | type | features | task_id | 最终 status | 备注 |
|---|---|---|---|---|---|---|
| 1a | BV1u44y1L7Vj | video | visual_prompt+video_summary+subtitle_export | note-a1332ac283d7 | SUCCESS | - |
| 1b | BV1u44y1L7Vj | audio | asr_summary+subtitle_export | note-86bbf008f274 | SUCCESS | - |
| 2 | yt shorts ERnYWR0OLKg | video | visual_prompt+video_summary+subtitle_export | note-751c8b35706a | SUCCESS | 需代理 7890 |
| 3 | xhslink o/6ADdwOBRd4R | image | describe+ocr+prompt | note-83c7505d8441 | FAILED | 外部限制：yt-dlp 不支持小红书图文图片下载；仅支持视频 |
| 4 | mp.weixin BSroSYpckb6OSc5_ZtWdng | text | summary_keypoints | note-6d9aa16c25c5 | FAILED | 外部限制：yt-dlp 不支持的 URL 格式 |
| 5 | v.douyin iJvcK8CLC_o | video | visual_prompt+video_summary+subtitle_export | note-01c7c54d5212 | FRAMES | 截帧卡在 76.6%，30min+ 无进展；DL/ASR 已完成 |
