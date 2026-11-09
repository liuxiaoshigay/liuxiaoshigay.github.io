# 留校是给

一个只有一页的"句子词云"：所有句子随机大小、随机颜色铺在纸面上；点一句，它飞到屏幕中央放大，底部出现说话人；点空白处（或按 Esc）回到词云。

- **纯静态**：HTML + CSS + 原生 JS，零构建，不需要装任何东西。唯一的外部库 d3-cloud 已经放在 `assets/vendor/` 里，不连 CDN、不请求外部字体。
- **句子写在 HTML 里**：不执行 JS 也能看到全部句子（对 SEO 和无脚本环境友好）。
- **手机和电脑同一套词云**：都走 d3-cloud，按屏幕面积决定铺多少句，不再单独做手机精简版。
- **不丢句子**：屏幕上显示不下时，剩下的都在右下角「全部 N 句」里，可搜索、可点开单看。

## 线上地址

<https://liuxiaoshigay.github.io/>

仓库名就是 `liuxiaoshigay.github.io`，属于 GitHub Pages 用户站，所以站点直接在根路径。

> 站名已改为「留校是给」；线上地址仍是 `https://liuxiaoshigay.github.io/`（GitHub Pages 用户站地址，改地址会断链）。

## 操作

| 操作 | 效果 |
| --- | --- |
| 点一句 | 飞到屏幕中央放大，底部显示说话人 |
| 点空白处 / `Esc` | 回到词云 |
| 右下角「全部 N 句」/ `L` | 打开全部句子列表（可搜索，点一条单独看） |
| 列表里点一条没铺进词云的句子 | 打开全屏单句视图，长句会自动换行 |
| 右下角「重排」/ `R` | 重新抽一批、重新随机大小和位置 |
| 进入页面 | 弹一次免责声明；「全部句子」底部可点“完整声明”重看 |

> 免责声明每个浏览器会话首次进入时弹一次；「全部句子」弹层底部常驻一行摘要。

## 投稿与审核

### 投稿（所有人，不需要 GitHub）

点右上角「＋ 提一句」，填说话人和句子，提交后写入 Supabase 的 `submissions` 表。

- 匿名只能 insert，**不能读取**；投稿内容不会公开。
- 站长在管理页审核：通过后写入 `quotes` 表，访客刷新站点就能看到；忽略则删除。
- 如果更想用腾讯问卷，把链接填到 `assets/js/site-config.js` 的 `submitUrl`，入口会直接打开问卷。

### 管理页（只有站长）

地址：<https://liuxiaoshigay.github.io/admin.html>

权限来自 **Supabase 管理键**（初始化 SQL 最后一段设置的随机串），不是隐藏地址。

1. 管理键只存在本机的 `localStorage`，只发给你的 Supabase 项目。
2. 粘贴 → **保存并连接**。
3. 「待审核投稿」可以 **通过 / 忽略**；「已上线的动态句子」可以手动添加、删除。
4. 访客没有删除入口；管理键泄露就在 SQL 里换一个新的（见管理页里的说明）。

> 静态的 59 句仍在 `index.html` 里，管理页只管**动态新增**的句子。要删静态句，改文件或告诉站长。

## 免责声明

页面为个人娱乐与虚构创作，不是新闻或事实陈述。句子、人名、地名、校名、事件等均为虚构、戏谑或化名表达，如有雷同纯属巧合；投稿不代表站长观点；请勿对号入座或用于骚扰、诽谤、人肉搜索。

侵权/隐私内容可通过「＋ 提一句」提交【删除/更正】并附具体句子，或到 GitHub 仓库提 Issue；核实后会删除或修改。完整文本见进入弹窗。

## 目录

```
liuxiao-site/
├── index.html              页面本体：结构 + 59 句静态句子
├── 404.html                404 页（样式内联，不依赖任何资源）
├── admin.html              管理页（不链接在站内，只有站长用）
├── favicon.svg             站点图标（SVG）
├── site.webmanifest        PWA 清单
├── robots.txt
├── README.md
└── assets/
    ├── css/style.css       站点样式
    ├── css/admin.css       管理页样式
    ├── js/site-config.js   Supabase URL / anon key / 可选问卷地址
    ├── js/quote-doc.js     旧版静态编辑工具（当前不使用）
    ├── js/admin.js         管理页：Supabase 管理键 + RPC
    ├── js/cloud-core.js    纯函数：字号范围、配色、宽度估算
    ├── js/cloud-layout.js  排版：d3-cloud 词云（桌面/手机同一套）
    ├── js/app.js           交互：渲染、聚焦动画、列表、投稿
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
- 句子建议 3–30 字。特别长的句子在词云里会被压得很小；超过画布宽度（约屏幕 80%）的句子不会进词云，列表里仍然有。

### 显示规则（想改数量看这里）

- **桌面和手机同一套**：按屏幕面积最多显示 56 句；390×844 的手机通常铺 20 句左右，桌面 36–56 句。长句优先落位，字号 11–56px；铺不下时整体等比缩小（最低 9px）。
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

- **主页面 DOM 测试**（jsdom，mock Supabase）：59 条静态 + 1 条动态 → 60 句；桌面 36 个词、手机 20 个词（同一套词云）；点击聚焦、点空白退出、打开列表、搜索过滤、单句视图、投稿 POST 到 `submissions`，全部通过。
- **管理页集成测试**（mock Supabase REST/RPC）：连接 → 通过待审核（1→2）→ 手动添加（→3）→ 删除（→2），RPC 都正确。
- 静态检查：重复 `id`、未闭合标签、本地资源引用、CSS 括号、manifest JSON（含 `admin.html` / `admin.css`）。
- 6 个 JS 文件 `node --check` 通过。
- 线上检查：首页 / 管理页 / 资源 200；Supabase 配置后还需要用一条真实投稿跑一遍待审核 → 通过 → 站点显示。

未做：

- **真浏览器截图 / 视觉回归**（构建环境的沙箱不允许启动无头浏览器）。第一次打开请重点看：桌面词云是否铺满、点击飞入是否顺滑、手机词云是否铺开、字号是否可读、弹层滚动、iOS Safari 的 `100dvh`。
- Safari 老版本、微信内置浏览器没有实测。

## 第三方

- **d3-cloud 1.2.9** — BSD-3-Clause，Copyright (c) 2013 Jason Davies，见 `assets/vendor/d3-cloud-LICENSE.txt`
- **d3-dispatch**（打包在 d3-cloud 内）— ISC，Copyright 2010-2026 Mike Bostock，见 `assets/vendor/d3-dispatch-LICENSE.txt`

## 关于句子

`index.html` 里现在有 59 句静态：50 句示例文本（说话人是"数学老师""室友""我妈"这类角色），另外 9 句来自 `名人名言.docx`（说话人是学明、Xu Li、学生、某中学、Zhou Jiahong、羊家儿、徐思为）。之后通过投稿/管理页新增的句子在 Supabase 的 `quotes` 表里，不在 HTML 里。
