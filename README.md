# 刘骁 · 句子

一个只有一页的"句子词云"：所有句子随机大小、随机颜色铺在纸面上；点一句，它飞到屏幕中央放大，底部出现说话人；点空白处（或按 Esc）回到词云。

- **纯静态**：HTML + CSS + 原生 JS，零构建，不需要装任何东西。唯一的外部库 d3-cloud 已经放在 `assets/vendor/` 里，不连 CDN、不请求外部字体。
- **句子写在 HTML 里**：不执行 JS 也能看到全部句子（对 SEO 和无脚本环境友好）。
- **窄屏自动换布局**：手机竖屏不再硬挤词云，改成"竖排散点"，保证字不会缩到 9px 看不清。
- **不丢句子**：屏幕上显示不下时，剩下的都在右下角「全部 N 句」里，可搜索、可点开单看。

## 操作

| 操作 | 效果 |
| --- | --- |
| 点一句 | 飞到屏幕中央放大，底部显示说话人 |
| 点空白处 / `Esc` | 回到词云 |
| 右下角「全部 N 句」/ `L` | 打开全部句子列表（可搜索，点一条单独看） |
| 列表里点一条没铺进词云的句子 | 打开全屏单句视图，长句会自动换行 |
| 右下角「重排」/ `R` | 重新抽一批、重新随机大小和位置 |

## 目录

```
liuxiao-site/
├── index.html              页面本体：结构 + 全部句子
├── 404.html                404 页（样式内联，不依赖任何资源）
├── favicon.svg             站点图标（SVG）
├── site.webmanifest        PWA 清单
├── robots.txt
├── README.md
└── assets/
    ├── css/style.css       全部样式
    ├── js/cloud-core.js    纯函数：字号范围、配色、宽度估算
    ├── js/cloud-layout.js  排版：宽屏 d3-cloud 词云 / 窄屏竖排散点
    ├── js/app.js           交互：渲染、聚焦动画、列表、键盘
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

## 换成别的名字 / 域名

要改的地方：

1. `index.html`：`<title>`、`<h1 class="brand__title">`、`description`、`og:*`、`canonical`
2. `404.html`：`<title>` 和 `.brand`
3. `site.webmanifest`：`name` / `short_name`
4. `assets/img/` 里的 `og.png`、`icon-*.png`、`favicon.svg`：都是按"刘骁"做的图，换名字需要重做
5. `canonical` 和 `og:image` 里现在用的是 punycode 形式 `xn--2br487o.xn--0iv.gay`（`刘骁.是.gay` 的 ASCII 写法）。换域名时记得同步，浏览器地址栏仍会显示中文。

## 配色 / 字体 / 动效

- 页面底色、墨色、圆角、留白：`assets/css/style.css` 顶部的 `:root`。
- 句子的随机颜色：`cloud-core.js` 里的 `GOLDEN_ANGLE`（色相间隔）、`SAT_MIN` / `SAT_RANGE`、`LIGHT_MIN` / `LIGHT_RANGE`。
- 聚拢动画快慢：`app.js` 的 `travelMs()`；首屏淡入在 `draw()` 里。
- 字体：只用系统字体（PingFang SC / 微软雅黑 / Noto Sans CJK），不联网。要换字体，**必须同时改** `style.css` 的 `--font` 和 `cloud-layout.js` 的 `FONT_FAMILY` —— 两处不一致会导致量出来的字宽和实际渲染不一致，词会重叠。

## 部署

把整个 `liuxiao-site/` 目录传到任意静态托管，站点根目录指向这个目录。不需要 Node、不需要构建命令。

### Cloudflare Pages（推荐，国内访问相对稳）

1. 控制台 → Workers & Pages → Create → Pages → **Upload assets**
2. 把 `liuxiao-site` 文件夹整体拖进去，Deploy
3. 会得到一个 `xxx.pages.dev` 的地址，先把站跑起来
4. 绑自定义域名：项目 → Custom domains → Set up a domain（前提是 `是.gay` 这个域名也在同一个 Cloudflare 账户下）

### Netlify

打开 <https://app.netlify.com/drop>，把文件夹拖进去即可。或用 CLI：`netlify deploy --prod --dir=liuxiao-site`。

### Vercel

`vercel --prod`，Framework 选 **Other**，Output Directory 填 `liuxiao-site`。

### GitHub Pages

推到仓库 → Settings → Pages → Deploy from a branch → 选根目录。根目录的 `404.html` 会被自动识别。

### 自己的服务器（Nginx）

```nginx
server {
    listen 443 ssl http2;
    server_name xn--2br487o.xn--0iv.gay;
    root /var/www/liuxiao-site;
    index index.html;
    error_page 404 /404.html;
    location / { try_files $uri $uri/ =404; }
}
```

HTTPS 用 certbot 或 Caddy 自动签。

## 域名：现在还不能访问

2026-11-07 实测 DNS：

| 域名 | 解析 |
| --- | --- |
| `周彬.是.gay` | `66.154.101.210` |
| `刘骁.是.gay` | **无记录（NXDOMAIN）** |

`是.gay` 这个二级域名的 DNS 不在这个站的代码里，必须有它的控制权的人加一条记录，`https://刘骁.是.gay/` 才会通：

```
刘骁    CNAME   <你的托管域名>
# 或
刘骁    A       <服务器 IP>
```

Cloudflare Pages 就是 `xxx.pages.dev`；Netlify 是 `xxx.netlify.app`。加完等几分钟生效，然后验证：

```powershell
nslookup 刘骁.是.gay
curl.exe -I https://刘骁.是.gay/
```

**如果拿不到 `是.gay` 的 DNS**：这个地址没法靠本站代码解决。可以先把站部署到 `xxx.pages.dev` 之类的免费域名，再请 `是.gay` 的所有者加记录；子域名本身不能单独购买。也可以换一个自己能控制的域名。

> 小提示：在自定义域名生效前，如果直接分享 `xxx.pages.dev` 的链接，`og:image` 仍指向 `xn--2br487o.xn--0iv.gay`（还没解析），社交平台可能抓不到分享图。可以临时把 `index.html` 里 `canonical` 和 `og:url` / `og:image` 换成 `xxx.pages.dev`，域名生效后再换回来。

## 已验证 / 未验证

已做：

- **DOM 级冒烟测试**（jsdom 真实解析 `index.html` 并加载四个脚本）：50 条句子 → 桌面 36 个词、手机 16 个散点；点击聚焦、点空白退出、打开列表、搜索过滤、从列表点选、未铺下句子的单句视图，全部通过。
- 静态检查：重复 `id`、未闭合标签、本地资源引用、CSS 括号、manifest JSON。
- 三个 JS 文件 `node --check` 通过。
- 字号与密度在 1440×900、1280×800、768×1024、390×844、360×640、320×568 上做过离屏量化。

未做：

- **真浏览器截图 / 视觉回归**：这台机器的沙箱不允许启动无头浏览器（mojo 命名管道被拒）。第一次打开请重点看：桌面词云是否铺满、点击飞入是否顺滑、手机竖排是否重叠、弹层滚动是否正常、iOS Safari 的 `100dvh` 表现。
- Safari 老版本、微信内置浏览器没有实测。

## 第三方

- **d3-cloud 1.2.9** — BSD-3-Clause，Copyright (c) 2013 Jason Davies，见 `assets/vendor/d3-cloud-LICENSE.txt`
- **d3-dispatch**（打包在 d3-cloud 内）— ISC，Copyright 2010-2026 Mike Bostock，见 `assets/vendor/d3-dispatch-LICENSE.txt`

## 关于示例句子

`index.html` 里的 50 句是示例文本（说话人是"数学老师""室友""我妈"这类角色），只是用来展示排版效果，换成你自己的即可。站点与 `周彬.是.gay` 在代码上没有关系，只是同一种呈现方式。
