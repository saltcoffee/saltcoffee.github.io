# 瓜瓜的博客

基于 Jekyll 的 GitHub Pages 博客。首页、文章、标签与 RSS 同时支持新的 `_articles` 和原来的 `_posts`，不需要额外构建插件。

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

需要封面时增加 `cover: /img/自己的照片.jpg` 和 `cover_alt: 照片的描述`，首页会显示照片。不设置封面时以文字列表显示。图片可放进 `img` 目录，正文中用 `![描述](/img/自己的照片.jpg)` 引用；使用项目子路径时，写成 `<img src="{{ '/img/自己的照片.jpg' | relative_url }}" alt="照片的描述">`。

草稿增加 `published: false`，正式发布时移除。独立页面或隐私政策增加 `listed: false`，不进入文章列表、标签、RSS与相邻文章导航。长文可增加 `catalog: true` 自动生成目录。

原来的 `_posts/YYYY-MM-DD-标题.md` 仍然可用。现有摄影文章迁入 `_articles`，通过 `permalink` 保留旧链接；两份隐私政策也保留原地址。

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

评论按文章的固定 URL 路径关联，标题修改不会改变对应评论。部署在项目子路径时，路径也包含 `baseurl`。Twikoo 后台的隐私设置 `SHOW_UA` 控制系统和浏览器信息，默认开启。

设置 `enabled: false` 可以关闭全站评论。单篇文章的 front matter 增加 `comments: false` 可以只关闭该篇评论。首页、标签、关于页和独立隐私政策不加载评论。

原 Utterances 的评论仍保存在 GitHub Issues 中，不会自动迁移到 Twikoo；本次替换不修改 GitHub 中的内容。

设置 `enabled: false` 可以关闭全站评论。单篇文章的 front matter 增加 `comments: false` 可以只关闭该篇评论。首页、标签、关于页和独立隐私政策不加载评论。

## 本地预览

使用 Ruby 3.1 或更新版本，并安装 Bundler：

```sh
bundle install
bundle exec jekyll serve --host 127.0.0.1 --port 4000
```

打开 http://127.0.0.1:4000 。只构建静态页面：

```sh
bundle exec jekyll build
```

也可以使用 `npm run dev` / `npm run build`，不需要安装 Node 依赖。Gemfile 固定 GitHub Pages 对应的 Jekyll、Markdown和代码高亮版本。

## GitHub Pages

沿用当前仓库的 GitHub Pages 发布方式；提交并推送后由 GitHub 构建。无需切换托管平台或额外配置工作流。

如果发布在项目子路径（例如 `/blog`），在 `_config.yml` 设置 `baseurl: /blog`，并把 `url` 保持为域名。本站导航、图片、订阅、离线缓存使用相对路径过滤器适配子路径。

样式在 `css/blog.css`，交互在 `js/blog.js`，页面模板在 `_layouts` 和 `_includes`。页面不依赖 Hux、Bootstrap、jQuery 或字体文件，旧主题资源与 Grunt 构建脚本已清理。

36 张胶片图片已保留原画幅、转换为网页尺寸，并配置懒加载；首图提供 960 和 1600 像素的首页封面。图片原片请另外留存，网页版本不替代原片。
