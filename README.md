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

文章底部使用 [Utterances](https://utteranc.es/)，配置位于 `_config.yml` 的 `utterances`：

```yaml
utterances:
  enabled: true
  repo: "saltcoffee/saltcoffee.github.io"
  issue_term: title
  label: Comment
  theme: github-light
```

评论存放在这个仓库的 GitHub Issues 中，按浏览器中的页面标题（文章标题 + 博客名称）关联。仓库需要公开、启用 Issues，并安装 Utterances GitHub App。`Comment` 标签需提前在仓库中创建，名称区分大小写。第一次有人发表评论时，会自动创建对应的 Issue；修改文章标题或博客名称时，应同步对应的 Issue 标题。

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
