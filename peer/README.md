# 他的IPS合规收银数据看板 · 自助接入说明（peer/）

本目录用于存放**同事维护、需要持续更新的 IPS 合规收银数据看板 HTML**。
导航页「他的IPS合规收银数据看板」分区会自动读取本目录下的 `manifest.json` 并渲染卡片，无需重生成首页。

## 一、你是逄总（一次配置）

1. 在 GitHub 仓库 `panghao007/retail-dashboard` → `Settings → Collaborators` 里，
   用同事的 GitHub 账号/邮箱把他加为**协作者**（只限这一个仓库，不会牵连你别的仓库）。
   **不要**把自己的 `ghp_…` token 给他——那是账号级全权，会波及你所有仓库。
2. 把本 README 发同事，他按下面步骤自助推即可。
   （若同事无 GitHub 账号，走「中继」方式：他把 HTML 发你，你放进 `peer/` 并改 `manifest.json` 后告诉我推送。）

## 二、你是同事（每次更新）

只需两步，推完几十秒后导航页「同事报表」区自动出现卡片。

```bash
# 1) 克隆（仅第一次）
git clone git@github.com:panghao007/retail-dashboard.git
cd retail-dashboard

# 2) 放入看板 HTML（文件名随意，放 peer/ 下）
cp /path/to/你的看板.html peer/渠道经营看板.html

# 3) 在 peer/manifest.json 加一条（数组里追加一个对象）
#    [
#      { "title": "渠道经营看板", "file": "peer/渠道经营看板.html", "updated": "2026-07-24" }
#    ]

# 4) 提交并推送
git add peer/
git commit -m "update peer: 渠道经营看板"
git push origin main
```

## 三、manifest.json 格式

```json
[
  { "title": "渠道经营看板", "file": "peer/渠道经营看板.html", "updated": "2026-07-24" },
  { "title": "门店日销看板", "file": "peer/门店日销看板.html", "updated": "2026-07-25" }
]
```

- `title`：导航卡片显示的标题
- `file`：HTML 相对站点根的路径，必须落在 `peer/` 下
- `updated`：更新日期（仅展示用）

## 四、注意事项

- 看板若依赖图片/CSS/JS 等**附属文件**，请一并放进 `peer/`，并在 HTML 里用**相对路径**引用。
- 看板按「保持原样」发布，不自动脱敏手机号、不加红字页脚（按逄总要求）。
- 每次改完 `manifest.json` 必须 `git add peer/ && git commit && git push`，导航页才会更新。
