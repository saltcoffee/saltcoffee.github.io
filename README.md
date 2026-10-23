# 瓜瓜的博客

基于 Jekyll 的个人博客，用于记录生活、摄影与技术。页面使用原生 HTML、CSS 和 JavaScript，文章以 Markdown 编写。

[访问博客](https://blog.twomelon.com/) · [订阅 RSS](https://blog.twomelon.com/feed.xml)

## 主要功能

- **文章归档**：首页按年份倒序分组，支持标签浏览与相邻文章导航。
- **全文搜索**：支持中文和多个关键词，匹配标题、正文、摘要与标签；搜索结果链接可以分享。
- **图片浏览**：正文图片自动接入查看器，支持缩略图、键盘切换、触屏滑动、放大与全屏。
- **文章评论**：使用 Twikoo，支持全站或单篇关闭评论。
- **订阅与离线阅读**：提供 RSS、自动生成的站点地图，以及基于 Service Worker 的离线缓存。

## 本地预览

本地运行需要 Ruby 和 Bundler，依赖版本由 `Gemfile` 与 `Gemfile.lock` 管理。

```sh
bundle install
bundle exec jekyll serve --host 127.0.0.1 --port 4000
```

启动后打开 <http://127.0.0.1:4000>。只生成静态页面时运行：

```sh
bundle exec jekyll build
```

构建结果位于 `_site/`。已安装 Node.js 时，也可以使用 `npm run dev`、`npm run preview` 或 `npm run build`；这些命令调用相同的 Bundler 命令，无需安装 Node 依赖。

## 写文章

在 `_articles/` 中新建 Markdown 文件，例如 `周末拍的照片.md`：

```markdown
---
title: 周末拍的照片
date: 2026-10-12 20:00:00 +0800
tags: [摄影, 胶片]
summary: 去公园走了一圈，带上了相机。
---

这里写正文。

![公园里的树](https://example.com/photo.jpg)
```

文件名不需要日期，页面标题取自 `title`，可以与文件名不同。新文章默认地址为 `/articles/文件名/`；原有 `_posts/YYYY-MM-DD-标题.md` 仍可使用。

### 文章配置

文章开头 `---` 之间的 YAML 称为 front matter，用于设置文章信息与展示行为。

| 字段 | 说明 |
| --- | --- |
| `title` | 必填，文章标题。 |
| `date` | 建议填写，包含时区，用于排序和日期显示；未填写时归入「未注明年份」。 |
| `tags` | 可选，标签数组，例如 `[摄影, 胶片]`。 |
| `summary` | 可选，用于搜索、RSS 摘要与分享描述。 |
| `permalink` | 可选，指定固定地址，例如 `/articles/weekend-film/`，避免改文件名后链接变化。 |
| `cover` | 可选，分享预览图片地址，不在首页列表中展示。 |
| `catalog` | 设为 `true`，根据正文标题生成目录。 |
| `published` | 设为 `false`，将文章标记为草稿；正式发布时移除此项。 |
| `listed` | 设为 `false`，从首页、搜索、标签、RSS 与相邻文章导航中排除。 |
| `sitemap` | 设为 `false`，从站点地图中排除。 |
| `comments` | 设为 `false`，关闭该篇文章的评论。 |
| `comment_path` | 可选，指定评论关联路径；文章地址变化时可填写原路径，保留已有评论。 |

`listed: false` 不会阻止通过链接访问文章，也不影响站点地图；如需同时从站点地图中排除，需另设 `sitemap: false`。

### 图片使用

正文直接使用 Markdown 图片语法或 HTML `<img>`，无需额外配置即可点击查看大图。支持图床 URL 与本地图片，外链图片无需下载到仓库。

桌面可用左右按钮、方向键或滚轮切换照片，手机可左右滑动。按 Esc 或点击关闭按钮后，会回到原阅读位置；图片加载失败时，可打开原图或继续浏览。

需要单独控制图片行为时，可使用：

```html
<!-- 排除图片查看器 -->
<img src="https://example.com/photo.jpg" alt="照片说明" data-gallery-ignore>

<!-- 为查看器指定缩略图 -->
<img src="https://example.com/photo.jpg" alt="照片说明"
     data-gallery-thumb="https://example.com/photo-thumb.jpg">
```

查看器仅收集文章正文中的图片。指向其他页面的图片链接保留原有跳转行为；未指定缩略图时使用正文图片地址。

## 评论设置

评论配置位于 `_config.yml` 的 `twikoo` 字段：

- `enabled`：控制是否启用全站评论。
- `env_id`：评论服务地址或环境 ID；为空时显示「评论暂未开放」。
- `region`：评论服务所需的区域配置。
- `version`：客户端版本，应与后端保持一致。

文章与关于页加载评论，关于页使用独立的评论路径。评论默认按页面 URL 路径关联，修改标题不会改变已有评论；调整文章地址时，可通过 `comment_path` 保留原评论关联。客户端脚本加载失败或超时后，评论区提供重新加载入口。

## 维护说明

- **站点信息**：标题、描述、语言等统一在 `_config.yml` 中维护；页面元信息与首页结构化数据由模板生成。
- **搜索**：导航栏提供搜索入口；首页实时筛选，其他页面提交后跳转至首页。按 Esc 或清空输入可恢复完整列表。
- **资源版本**：修改 CSS、JavaScript 或站点图标时，同步更新 `_config.yml` 的 `asset_version` 与 `sw.js` 的 `ASSET_VERSION`。
- **离线缓存**：页面与静态资源联网时优先获取最新内容，请求失败时使用缓存。照片使用独立缓存，最多保留 48 个可验证成功的图片响应，有效期为 7 天；无法读取响应的外链图片使用浏览器自身缓存。
- **图片更新**：查看器在页面内复用最近浏览的 12 张大图。替换同一地址的照片时，可更换文件名或添加 URL 版本参数，确保显示新内容。
- **站点地图**：`jekyll-sitemap` 自动生成 `sitemap.xml` 与 `robots.txt`；使用 `sitemap: false` 可排除指定文章或页面。
