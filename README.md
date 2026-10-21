# 瓜瓜的博客

基于 Jekyll 的 GitHub Pages 博客。首页、文章、标签与 RSS 同时支持新的 `_articles` 和原来的 `_posts`，站点地图由 GitHub Pages 支持的 `jekyll-sitemap` 自动生成。

## 写文章

在 `_articles` 中新建 Markdown 文件，例如 `周末拍的照片.md`。**文件名不用带日期；页面标题只取 `title`，可以和文件名不同。**

```markdown
---
title: 周末拍的照片
date: 2026-10-12 20:00:00 +0800
tags: [摄影, 胶片]
summary: 去公园走了一圈，带上了相机。
---

这里写正文。
```

`title` 必填。`date` 用于排序和显示，建议填写；`tags` 和 `summary` 可选。不填日期时页面不显示日期。日期只在元数据里填写，不参与标题。

新文章默认地址是 `/articles/文件名/`。如果希望改文件名后地址也不变，可以指定固定地址：

```yaml
permalink: /articles/weekend-film/
```

首页文章按年份倒序分组，每篇只显示标题和月日，点击标题阅读正文；未填写日期的文章单独归入「未注明年份」。搜索仍匹配正文、摘要和标签，并自动隐藏没有匹配结果的年份组。可选的 `cover: https://example.com/photo.jpg` 仅用于文章链接的分享预览。正文图片直接使用图床 URL，例如 `![描述](https://example.com/photo.jpg)`。查看器自动支持这些外链，不会把图片下载进仓库。本地图片地址也兼容。

草稿增加 `published: false`，正式发布时移除。独立页面或隐私政策增加 `listed: false`，不进入文章列表、标签、RSS与相邻文章导航。长文可增加 `catalog: true` 自动生成目录。

原来的 `_posts/YYYY-MM-DD-标题.md` 仍然可用。摄影文章位于 `_articles`，当前地址为 `/articles/2025-film-record/`；原来的日期地址和中文文章地址通过 `redirects/` 下的两个页面直接跳转到当前地址，启用 JavaScript 时保留查询参数和锚点。跳转页共用 `_layouts/redirect.html`，同时提供即时 meta refresh，方便不执行 JavaScript 的抓取工具识别迁移。两份隐私政策保留原地址。

## 搜索

搜索框位于全站导航最右侧。首页实时筛选文章，支持中文和多个关键词；在其他页面提交搜索后，会回到首页显示结果。按 Esc 或清空搜索框可恢复文章列表，提交后的搜索地址可以分享。

## 图片浏览

所有文章正文的图片会自动加入图片查看器。以后使用普通 Markdown 的 `![说明](图片地址)` 或 HTML `<img>` 即可，不需要额外 front matter，也不需要填写图片宽高。点击正文照片即可打开大图。

桌面支持右侧缩略图、左右按钮、方向键、滚轮翻图、放大和全屏；手机支持左右滑动，缩略图位于下方。按 Esc 或点击关闭后回到文章原位置。图片加载失败时可查看原图或继续翻下一张。

查看器使用半透明灰绿色背景。当前页面最多保留最近浏览的 12 张大图，重复打开或来回切换会直接复用；同一相册的缩略图也会保留已加载的内容。

浏览器另有图片缓存，最多保存 48 个可验证成功的图片响应，有效期 7 天，命中时不会再发起后台请求。更新样式或脚本不会清掉这部分缓存。线上现有图床与博客同源，可使用该缓存；无法读取响应的外链仍使用浏览器自身的 HTTP 缓存和查看器的页面内复用。缓存仅保存在访客浏览器中，仓库仍只保存图片 URL。替换同一地址的照片时，可修改文件名或在 URL 添加版本参数，让新照片立即生效。

查看器只收集文章正文，不包含头像、评论图片和站点图标。链接到其他页面的图片仍保留原来的链接功能；需要排除某张正文图片时，可给 `<img>` 添加 `data-gallery-ignore`。缩略图可选填 `data-gallery-thumb="缩略图地址"`，不填就使用正文图片 URL，不生成或保存本地缩略图。缩略图按可见范围延迟加载。

## 评论

文章底部使用 [Twikoo](https://twikoo.js.org/)，配置位于 `_config.yml` 的 `twikoo`：

```yaml
twikoo:
  enabled: true
  env_id: "https://你的站点名.netlify.app/.netlify/functions/twikoo"
  region: ""
  version: "2.0.13"
```

Twikoo 需要单独的后端服务，GitHub Pages 只负责托管博客。可参考[官方部署说明](https://twikoo.js.org/backend.html)部署到 Netlify、Vercel、腾讯云 CloudBase 等平台，再填写实际服务地址。Netlify 的 `env_id` 必须包含 `/.netlify/functions/twikoo` 后缀；Vercel 和私有部署填服务根地址（`https://` 加域名，不带路径）；腾讯云 CloudBase 填环境 ID，并按需设置 `region`。

客户端固定版本，需与后端保持一致。服务地址使用精简客户端，腾讯云环境自动使用包含 CloudBase SDK 的完整客户端。`env_id` 留空或只有空格时不加载客户端，页面显示“评论暂未开放”。

评论按文章的固定 URL 路径关联，标题修改不会改变对应评论。路径统一使用浏览器 `pathname` 的编码形式（中文转为 `%…`），部署在项目子路径时也包含 `baseurl`，与已有评论的地址保持一致。

已发布文章更换地址时，可在 front matter 增加 `comment_path: /原来的文章路径/`，让评论继续使用原路径，无需迁移数据库。摄影文章保留了原日期路径作为评论标识；新文章不需要此项，默认使用文章 URL。旧链接的跳转页需同步指向新地址。

Twikoo 后台的隐私设置 `SHOW_UA` 控制系统和浏览器信息，默认开启。现代 Safari 的 macOS UA 固定报告 `10_15_7`，无法据此获取真实系统版本；前端将有歧义的“macOS Catalina”标签显示为“macOS”，保留数据库的原始 UA。其他已识别的系统版本与浏览器标签继续显示。Twikoo 2.0.13 会在浏览器提供 User-Agent Client Hints 时补充系统版本，因此部分 Chromium 浏览器能显示 Sequoia 等名称。

客户端脚本加载超过 15 秒或失败时，可在评论区重新加载；评论数据请求的错误由 Twikoo 自己提示。 系统标签在加载回调和评论区局部更新后都会重新检查，覆盖新评论、回复和加载更多。

页面、CSS、JS 和站点清单在联网时优先向服务器验证最新内容，仅在网络请求失败时使用对应的离线缓存。照片仍采用前述独立缓存，样式更新不会导致照片重复下载。已安装 Service Worker 的浏览器在页面头部检查更新，不等待文章图片加载结束；首次访问仍优先加载页面，也不会强制刷新正在阅读或填写评论的页面。

全站图标由 `_includes/icons.html` 统一声明，独立隐私政策和旧文章跳转页也使用相同图标。标签图标使用苹方“瓜”字的 SVG 路径与多尺寸 ICO，分别位于 `img/favicon-pingfang.svg` 和根目录 `favicon.ico`；根目录图标同时兼容浏览器的默认请求。Apple Touch 与 PWA 图标使用相同字形。图标在联网时验证最新内容，离线时使用对应缓存，不进入照片的 7 天缓存。原 `img/favicon.svg` / `img/favicon.ico` 保留为旧页面的兼容资源。

静态资源链接带 `_config.yml` 的 `asset_version`，修改 CSS/JS 或站点图标时同步更新该值与 `sw.js` 的 `ASSET_VERSION`，离线预缓存使用相同版本。曾使用旧 Hux 主题的浏览器可能在升级 Service Worker 的第一次访问中显示旧页面；新 worker 激活后，下一次导航或刷新才会使用新策略。

设置 `enabled: false` 可以关闭全站评论。单篇文章的 front matter 增加 `comments: false` 可以只关闭该篇评论。文章和关于页加载评论；首页、标签和独立隐私政策不加载评论。关于页评论单独关联 `/about/`，不与文章评论混合。

原 Utterances 的评论仍保存在 GitHub Issues 中，不会自动迁移到 Twikoo；本次替换不修改 GitHub 中的内容。

## Google 搜索收录

每次构建会自动生成根目录的 `sitemap.xml` 和 `robots.txt`，使用 `_config.yml` 中的正式域名。站点地图包含首页、关于页、标签页及已发布文章，排除 Google 验证文件、404 页、离线页和旧地址跳转页。需要单独排除某篇文章或页面时，在 front matter 中添加 `sitemap: false`；`listed: false` 只影响文章列表、标签和 RSS，不控制搜索收录。

发布后确认 https://blog.twomelon.com/sitemap.xml 可以打开，再在 Google Search Console 中添加并验证 `https://blog.twomelon.com/` 资源，进入「站点地图」提交 `sitemap.xml`。后续发布文章会自动更新地图，通常不需要重新提交。仓库已有 Google 验证文件，但新资源仍需在 Search Console 中确认所有权，按其提示补充验证。

搜索结果顶部的网站名称通过首页的 `WebSite` JSON-LD 声明：`name` 使用 `_config.yml` 的 `SEOTitle`，`url` 使用正式首页地址，与现有标题和 `og:site_name` 保持一致。发布后可在 Search Console 中检查首页并请求重新编入索引，等待 Google 重新抓取与处理。这个声明表达首选名称，最终是否采用及更新时间由 Google 决定；不会改变搜索结果中显示的网址。规范见 [Google 网站名称文档](https://developers.google.com/search/docs/appearance/site-names?hl=zh-cn)。

## 本地预览

使用 Ruby 3.1 或更新版本，并安装 Bundler：

```sh
bundle install
bundle exec jekyll serve --host 127.0.0.1 --port 4000
```

如果 `bundle` 报 Bundler 版本冲突，或 `vendor/gems` 中的 gem 与 `Gemfile.lock` 不一致，可以改用 `tools/` 下不依赖 Bundler 的脚本（它们直接使用 `vendor/gems`）：

```sh
ruby tools/build.rb          # 生成 _site，约 0.5 秒
ruby tools/serve.rb 4000     # 托管 _site，打开 http://127.0.0.1:4000
```

`tools/serve.rb` 不做文件监听：改完内容运行一次 `ruby tools/build.rb`，再刷新浏览器即可，**不需要重启服务**。`bundle exec jekyll serve` 在本仓库不可用的原因是缺 `rb-inotify`，文件监听无法启动；`tools/serve.rb` 因此改成只托管构建结果。

打开 http://127.0.0.1:4000 。只构建静态页面：

```sh
bundle exec jekyll build
```

也可以使用 `npm run dev` / `npm run build`，不需要安装 Node 依赖。Gemfile 固定 GitHub Pages 对应的 Jekyll、Markdown和代码高亮版本。

## GitHub Pages

沿用当前仓库的 GitHub Pages 发布方式；提交并推送后由 GitHub 构建。无需切换托管平台或额外配置工作流。

### 域名迁移到 blog.twomelon.com

仓库中的 `CNAME` 已设为 `blog.twomelon.com`，`_config.yml` 的 `url` 已设为 `https://blog.twomelon.com`，`baseurl` 保持为空。构建时 canonical、Open Graph、首页结构化数据、RSS、站点地图与 robots.txt 都从这一配置生成正式地址。文章路径和 Twikoo 的评论路径保持不变，已有评论继续按原路径关联。

图床来自独立的 [saltcoffee/pic_bed](https://github.com/saltcoffee/pic_bed) GitHub Pages 项目站点，文章统一通过 `/pic_bed/...` 访问。《还没有吹过太平洋的风》的明信片图片也已改为这一形式。未单独配置自定义域名的项目站点会自动沿用账户站点的域名，因此无需把图片复制进博客仓库；切换后仍需确认 `https://blog.twomelon.com/pic_bed/blog/tw_mingxinpian.jpg` 与胶片文章的照片均可访问。[GitHub 多仓库域名说明](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages#using-a-custom-domain-across-multiple-repositories)

以下线上操作需要在对应账户完成，仓库内的修改不会代替这些操作：

1. 建议先在 [GitHub 个人设置 → Pages](https://github.com/settings/pages) 添加并验证 `twomelon.com`。将 GitHub 提供的 TXT 记录添加到 Cloudflare，记录名为 `_github-pages-challenge-saltcoffee`，记录值以 GitHub 实际显示为准，验证后保留记录。验证根域名也会保护 `blog.twomelon.com`。[GitHub 域名验证说明](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
2. 自行提交并推送本次修改，等待 GitHub Pages 部署完成。本次配置修改未提交、未推送。
3. 打开[仓库 Settings → Pages](https://github.com/saltcoffee/saltcoffee.github.io/settings/pages)，确认 Custom domain 为 `blog.twomelon.com`，不带协议或路径；如果没有自动更新，手动填写并保存。分支发布时，GitHub 网页保存域名可能会生成修改 `CNAME` 的提交，之后需同步本地仓库。
4. 在 Cloudflare 的 `twomelon.com` → DNS → Records 中添加或确认下表记录。只配置 `blog`，根域名和 `www` 无需指向博客。先使用 DNS only，让 GitHub 直接验证 DNS 并签发证书。[GitHub 子域名配置说明](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

   | 类型 | 名称 | 目标 | 代理状态 | TTL |
   | --- | --- | --- | --- | --- |
   | CNAME | `blog` | `saltcoffee.github.io` | DNS only（灰云） | Auto |

5. 等待 GitHub Pages 的 DNS 检查和证书签发完成，勾选 Enforce HTTPS。该选项可能需要最多 24 小时才可用。
6. 新域名正常后，在旧域名的托管平台设置从 `blog.redpencil.top` 到新域名的 301 跳转，保留文章路径和查询参数。若旧域名也托管于 Cloudflare，可在 `redpencil.top` → Rules → Redirect Rules 创建动态规则（旧域名对应的 DNS 记录必须开启代理）：

   匹配条件：

   ```text
   (http.host eq "blog.redpencil.top")
   ```

   动态目标表达式：

   ```text
   concat("https://blog.twomelon.com", http.request.uri.path)
   ```

   状态码选 `301`，开启 Preserve query string。先确认新域名下的 `/pic_bed/` 图片可用，再启用整站跳转，让旧文章链接与旧图片链接一起迁移。[Cloudflare 跳转配置说明](https://developers.cloudflare.com/fundamentals/manage-domains/redirect-domain/)
7. 检查 Twikoo 后端：如果配置过站点地址或通知中的站点链接，更新为新域名。2026-10-21 对现有 Netlify 服务的 OPTIONS 预检已返回 `204` 且允许 `https://blog.twomelon.com`；正式切换后仍需实际验证评论加载，如果被后端域名限制拦截，再将新域名加入允许列表。前端继续使用现有 Netlify 服务，无需迁移评论数据库。
8. 在 Google Search Console 添加并验证新资源，提交新站点地图；旧资源可用时，按「地址更改」流程申报迁移。此操作应在 301 跳转生效后进行。

迁移后检查：首页、文章、关于页、评论、`/pic_bed/` 图床图片、`/feed.xml`、`/sitemap.xml` 和 `/robots.txt` 均可正常访问；canonical 和 RSS 的正式地址使用新域名，旧文章 URL 以 301 跳转到新域名相同路径。若曾安装旧域名的 PWA，需要从新域名重新安装；浏览器不会跨域迁移其离线缓存。

如果发布在项目子路径（例如 `/blog`），在 `_config.yml` 设置 `baseurl: /blog`，并把 `url` 保持为域名。本站导航、图片、订阅、离线缓存使用相对路径过滤器适配子路径。

样式在 `css/blog.css`，交互在 `js/blog.js`，图片查看器在 `css/gallery.css` 和 `js/gallery.js`，页面模板在 `_layouts` 和 `_includes`。页面不依赖 Hux、Bootstrap、jQuery 或字体文件，旧主题资源与 Grunt 构建脚本已清理。

胶片文章的 36 张照片沿用原图床 URL，保留原画幅并配置懒加载；仓库只保存文章里的链接。
