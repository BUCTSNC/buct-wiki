# Buct Wiki

## 简介
Buct Wiki是一个由北京化工大学（Beijing University of Chemistry Technology）学生网络中心（SNC, Student Network Center）社团成员自主维护的百科网站。

# 文档规范

## 编辑此页

每页提供“编辑此页”入口：正文页位于标题旁和底部，首页位于主视觉区域上方，独立反馈页保留标题旁的入口。百科文章自动链接到 `BUCTSNC/buct-wiki-content` 仓库中对应的源文件；首页等内置文档链接到 `BUCTSNC/buct-wiki` 仓库，均使用 `main` 分支。

新增 Markdown/MDX 文档无需配置编辑链接。可在 frontmatter 中设置 `editUrl: false` 隐藏入口，或设置 `editUrl` 为完整 URL 覆盖自动链接。使用 `StarlightPage` 的自定义 Astro 页面需要在 `frontmatter.editUrl` 中指定对应源文件的 GitHub 编辑地址。

正文末尾统一展示内容许可、参考信息提醒和第三方材料说明。除另有注明及第三方材料外，本站原创内容采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)；学校文件、引用、图片和外部附件等按原始来源的权利声明及适用法律使用，不因收录而获得本站 CC 授权。转载材料时请保留原始来源和权利声明。

正文后先展示参考信息提醒，再提供独立的编辑与反馈操作区；内容许可位于操作区下方、翻页导航上方。提醒和许可均可独立展开详细说明，第三方版权说明包含在内容许可内；编辑者署名保留在页首。反馈表单在填写前提示权利事项的邮件渠道，独立反馈页不重复展示文章编辑操作区，也不展示学校通知提醒。正文开头若重复页面标题，仅在两者完全一致时隐藏重复标题，源文件保持原样。

## MarkDown规范

文档遵循 [GitHub Flavored Markdown（GFM）](https://github.github.com/gfm/) 标准。

图片或其他资源请放置在当前文档同级目录的`assets/{{ 当前文档名 }}/`中，文件名需要有明确含义，例如

```text
校园生活/
├── 食堂.mdx
├── 宿舍.mdx
└── assets/
    ├── 食堂/
    │   ├── 食堂入口.jpg
    │   └── 菜单.png
    └── 宿舍/
        └── 宿舍环境.jpg
```

## FrontMatter规范

Frontmatter 位于文档开头的两行 `---` 之间，使用 YAML 语法。

| 字段 | 含义 | 值类型   | 是否必填 | 默认值 |
| --- | --- |-------| - | -- |
| `title` | 页面标题 | 字符串   | 是 | 无 |
| `description` | 页面内容的简短描述 | 字符串   | 否 | 无 |
| `template` | 页面布局 | 枚举字符串 | 否 | `doc` |
| `type` | 信息类型；非一般信息会在标题前显示对应标签 | 枚举字符串 | 否 | `general` |
| `tags` | 用于分类和检索页面的标签 | 无序列表  | 否 | 无 |
| `feedback` | 是否显示内容反馈入口 | 布尔值   | 否 | `true` |

### `template` 页面布局

| 值 | 含义 |
| --- | --- |
| `doc` | 标准文档页面，显示侧边栏 |
| `splash` | 宽屏页面，不显示侧边栏 |

### `type` 信息类型

| 值 | 含义 |
| --- | --- |
| `general` | 公开信息或一般信息 |
| `official` | 官方发布或可由官方来源确认的信息 |
| `experience` | 投稿者的个人经验或主观建议 |



示例：

```yaml
---
title: 学校官网
description: 北京化工大学学校官方网站汇总
type: official
tags:
  - 官网
  - 办事大厅
  - 教务系统
---
```
