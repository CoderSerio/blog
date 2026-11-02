---
name: blog-code-flow
description: 在本博客的 Markdown 文章里使用已有的 CodeFlow 组件，画出需要读者对照真实代码的流程图，例如调用方与实现、两种实现的对比、跨文件的导入与导出。
---

先定下读者看完能回答的一个具体问题，把它写进 `figcaption`。如果答案取决于某行代码，就把那行代码放在对应的节点里，并标明它属于哪个文件。比如解释导出别名时，同时展示 `export { messages as t }` 和 `import { t as messages }`：读者可以自己顺着同一个名字找到两端。如果只需要交代依赖方向，用已有的 Mermaid 图即可；单段代码能说清楚的，也无需画图。

### 在文章里写

博客的 [Markdown 包装组件](../../../src/components/content/Markdown/index.astro) 已经注册了 [CodeFlow](../../../src/components/content/CodeFlow/index.astro)。在文章里直接用小写的 `<code-flow>`。下面是一个最小例子；保留围栏代码块上下的空行，让 Markdown 在 HTML 中正常解析它。

````markdown
<code-flow class="mermaid-pixel-frame" data-diagram-label="Chunk exports">
<figure>
<figcaption>Which export does <code>page.js</code> read?</figcaption>
<div class="flow-grid">
<div class="flow-node flow-internal">
<strong>page.js · consumer</strong>

```js showLineNumbers=false
import { t as messages } from './form.js';
```

</div>
<div class="flow-node flow-public">
<strong>form.js · provider</strong>

```js showLineNumbers=false
export { messages as t };
```

</div>
</div>
</figure>
</code-flow>
````

`mermaid-pixel-frame` 和 `data-diagram-label` 复用站内 Mermaid 的图框和左上角短标题；组件从 `figcaption` 取预览的无障碍名称，并提供放大按钮和缩放。每张图用一个直接子元素 `figure`，不要在文章里另写按钮或复制 CSS。

### 选一个已有布局

在[这篇 Rolldown 文章的源码](../../../src/content/posts/feopack-rolldown-code-splitting.md)里搜索下面的标记，就能找到完整范例：

- **一个流程里有多个文件**：搜索 `data-diagram-label="Entry facade"`。用 `flow-grid` 放节点；需要说明连线时，用 `flow-edge` 写明谁读取或转发什么。`flow-output` 可让底部节点横跨两列。
- **同一个问题有两种走法**：搜索 `id="module-table-vs-esm"`。外层加 `binding-map`，每条 `lookup-lane` 展示一种实现，`lookup-route` 里的两张 `lookup-card` 由箭头相连；窄屏时按阅读顺序上下排列。`data-runtime="esm"` 是该示例的 ESM 配色，不是通用组件必填的字段。

在本地打开实际文章，按桌面和手机宽度各读一遍：代码、文件名是否完整？图变为纵向后还能跟上箭头吗？再点右上角放大，确认两端仍然对应。遇到拥挤，先调整代码换行和节点布局，保留解释机制所需的标识符。
