# 刘骁是gay

一个只有一页的"句子词云"：所有句子随机大小、随机颜色铺在纸面上；点一句，它飞到屏幕中央放大，底部出现说话人；点空白处（或按 Esc）回到词云。

- **纯静态**：HTML + CSS + 原生 JS，零构建，不需要装任何东西。唯一的外部库 d3-cloud 已经放在 `assets/vendor/` 里，不连 CDN、不请求外部字体。
- **句子写在 HTML 里**：不执行 JS 也能看到全部句子（对 SEO 和无脚本环境友好）。
- **窄屏自动换布局**：手机竖屏改成"竖排散点"，保证字不会缩到 9px 看不清。
- **不丢句子**：屏幕上显示不下时，剩下的都在右下角「全部 N 句」里，可搜索、可点开单看。

## 线上地址

<https://liuxiaoshigay.github.io/>

仓库名就是 `liuxiaoshigay.github.io`，属于 GitHub Pages 用户站，所以站点直接在根路径。

## 操作

| 操作 | 效果 |
| --- | --- |
| 点一句 | 飞到屏幕中央放大，底部显示说话人 |
| 点空白处 / `Esc` | 回到词云 |
| 右下角「全部 N 句」/ `L` | 打开全部句子列表（可搜索，点一条单独看） |
| 列表里点一条没铺进词云的句子 | 打开全屏单句视图，长句会自动换行 |
| 右下角「重排」/ `R` | 重新抽一批、重新随机大小和位置 |

## 投稿与审核

### 投稿（所有人）

点右上角「＋ 提一句」：

- **默认**：打开站内表单，填说话人和句子，提交会跳转到 GitHub Issue（需要投稿人有 GitHub 账号）。站长在 <https://github.com/liuxiaoshigay/liuxiaoshigay.github.io/issues> 查看，审核后用管理页加入。
- **换成腾讯问卷/问卷星**：建一个表单（字段：说话人、句子），把链接填到 `assets/js/site-config.js` 的 `submitUrl`。之后「＋ 提一句」直接打开问卷，同学不用注册 GitHub。

投稿不会立即出现在词云里；只有站长通过管理页加入后才会。

### 管理页（只有站长）

地址：<https://liuxiaoshigay.github.io/admin.html>

这个页面不在站内链接，`robots.txt` 也禁止收录；但真正的权限来自 GitHub 令牌，不是隐藏地址。

1. 创建一个 **fine-grained token**：
   - GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token
   - Resource owner：`liuxiaoshigay`
   - Repository access：Only select repositories → `liuxiaoshigay.github.io`
   - Permissions → Repository permissions → **Contents: Read and write**；**Issues: Read and write**（用于读取和关闭投稿 Issue）。Metadata 自动 Read。
2. 把 `github_pat_...` 粘到管理页，点“保存并连接”。令牌只存在这台浏览器的 `localStorage`，只发往 `api.github.com`。
3. 在管理页添加/删除句子；上面的“待审核投稿”会列出 GitHub Issues，点“加入词云”即发布并自动关闭该 Issue。
4. 删除只能在持有令牌的浏览器里做，访客没有入口。
5. 每次提交后 GitHub Pages 约 1 分钟更新。

> 不要用 classic token；只给这个仓库的 Contents 读写。公用电脑上用完点“清除本机令牌”；令牌泄露就去 GitHub 同页面 Revoke。

## 目录

```
liuxiao-site/
├── index.html              页面本体：结构 + 全部句子
├── 404.html                404 页（样式内联，不依赖任何资源）
├── admin.html              管理页（不链接在站内，只有站长用）
├── favicon.svg             站点图标（SVG）
├── site.webmanifest        PWA 清单
├── robots.txt
├── README.md
└── assets/
    ├── css/style.css       站点样式
    ├── css/admin.css       管理页样式
    ├── js/site-config.js   仓库/投稿地址等配置
    ├── js/quote-doc.js     纯函数：解析/增删 index.html 里的句子
    ├── js/admin.js         管理页逻辑：GitHub Contents API 增删
    ├── js/cloud-core.js    纯函数：字号范围、配色、宽度估算
    ├── js/cloud-layout.js  排版：宽屏 d3-cloud 词云 / 窄屏竖排散点
    ├── js/app.js           交互：渲染、聚焦动画、列表、投稿入口
    ├── vendor/             d3-cloud 及其许可证
    └── img/                图标与分享图（og.png）
```

## 本地预览

直接双击 `index.html` 即可（全是相对路径和经典脚本，`file://` 能跑）。建议把窗口拉宽、再用浏览器开发者工具切到手机尺寸各看一次。

## 改句子

打开 `index.html`，找到这段：

```html
<ul id="quotes" class="quotes">
  <li data-speaker="数学老师">这道题我讲过八百遍了。</li>
  <li data-speaker="室友">我从来不熬夜，我只是睡得晚。</li>
  ...
</ul>
```

一行一句，格式是 `<li data-speaker="说话人">句子正文</li>`。

- `data-speaker` 可以留空，也可以整个属性删掉 —— 那样底部就不显示说话人。
- 正文里如果有 `<` 或 `&`，要写成 `&lt;` / `&amp;`，否则 HTML 会解析错。
- 句数不限，但**词云一次不会全显示**，规则见下。
- 句子建议 3–30 字。特别长的句子在词云里会被压得很小；手机端超过一定宽度会直接不进词云（列表里仍然有）。

### 显示规则（想改数量看这里）

- **桌面**（宽 ≥ 620px）：按屏幕面积最多显示 56 句，长句优先落位，字号 12–56px；铺不下时整体等比缩小。
- **手机**（宽 < 620px）：从短句里抽 12–18 句，竖排散点，字号 12–26px。
- 视口里放不下的句子不会消失，全部在「全部 N 句」列表里；点一条没铺进词云的句子会打开全屏单句视图，长句自动换行。
- 每次加载、点「重排」或改窗口大小都会重新抽一批、重新随机大小和颜色。

想调这些数字：

- 每个屏幕显示几句 → `assets/js/app.js` 的 `chooseShowcase()`
- 词云最小字号 → `app.js` 的 `MIN_CLOUD_SIZE`
- 随机字号范围 → `assets/js/cloud-core.js` 的 `FONT_MIN` / `FONT_MAX` / `FONT_SHRINK_*`
- 词云铺满程度 → `assets/js/cloud-layout.js` 的 `TARGET_FILL`（越大越挤）

## 配色 / 字体 / 动效

- 页面底色、墨色、圆角、留白：`assets/css/style.css` 顶部的 `:root`。
- 句子的随机颜色：`cloud-core.js` 里的 `GOLDEN_ANGLE`（色相间隔）、`SAT_MIN` / `SAT_RANGE`、`LIGHT_MIN` / `LIGHT_RANGE`。
- 聚拢动画快慢：`app.js` 的 `travelMs()`；首屏淡入在 `draw()` 里。
- 字体：只用系统字体（PingFang SC / 微软雅黑 / Noto Sans CJK），不联网。要换字体，**必须同时改** `style.css` 的 `--font` 和 `cloud-layout.js` 的 `FONT_FAMILY` —— 两处不一致会导致量出来的字宽和实际渲染不一致，词会重叠。

## 部署

当前使用 GitHub Pages 用户站：仓库名 `liuxiaoshigay.github.io`，`main` 分支根目录直接发布到 <https://liuxiaoshigay.github.io/>，不需要构建命令。

### 其他静态托管

把整个目录传到任意静态托管，站点根目录指向这个目录即可。Cloudflare Pages、Netlify、Vercel 都是"上传目录 → 得到临时域名"。`404.html` 放在根目录，GitHub Pages / Netlify 会自动识别。

## 已验证 / 未验证

已做：

- **主页面 DOM 测试**（jsdom）：59 条句子 → 桌面 36 个词、手机 16 个散点；点击聚焦、点空白退出、打开列表、搜索过滤、从列表点选、未铺下句子的单句视图、投稿弹窗生成 GitHub Issue 链接，全部通过。
- **管理页集成测试**（mock GitHub Contents/Issues API）：连接 → 把待审核 Issue 加入（59→60）→ 手动添加（→61）→ 删除（→60），写入内容、计数和 Issue 关闭都正确。
- **QuoteDoc 单元测试**：59→60→59，HTML 转义、按序号删除。
- 静态检查：重复 `id`、未闭合标签、本地资源引用、CSS 括号、manifest JSON（含 `admin.html` / `admin.css`）。
- 6 个 JS 文件 `node --check` 通过。
- 线上检查：首页 200、59 句、CSS/JS/图标全部 200、自定义 404 生效。

未做：

- **真浏览器截图 / 视觉回归**（构建环境的沙箱不允许启动无头浏览器）。第一次打开请重点看：桌面词云是否铺满、点击飞入是否顺滑、手机竖排是否重叠、弹层滚动、iOS Safari 的 `100dvh`。
- Safari 老版本、微信内置浏览器没有实测。

## 第三方

- **d3-cloud 1.2.9** — BSD-3-Clause，Copyright (c) 2013 Jason Davies，见 `assets/vendor/d3-cloud-LICENSE.txt`
- **d3-dispatch**（打包在 d3-cloud 内）— ISC，Copyright 2010-2026 Mike Bostock，见 `assets/vendor/d3-dispatch-LICENSE.txt`

## 关于句子

`index.html` 里现在有 59 句：50 句是示例文本（说话人是"数学老师""室友""我妈"这类角色），另外 9 句来自 `名人名言.docx`（说话人是学明、徐历、学生、市西、周家宏、羊家儿、徐思为）。换成你自己的即可。
