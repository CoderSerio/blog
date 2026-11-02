---
title: "Feopack: How Does Rolldown Split Chunks?"
published: 2026-11-01
description: "Following a Rolldown dynamic-import bug to understand shared dependencies, cross-chunk exports, and the boundary between a module and a chunk."
image: ''
tags: [Rust, Bundler, Feopack, Rolldown, Code Splitting, ESM]
category: Projects
draft: false
lang: en
---

I originally planned to leave code splitting for a later chapter. Feopack still puts every module into one chunk, and there were other parts of the compiler I wanted to explore first.

But recently, while reading bundler implementations and looking for opportunities to contribute, I came across [Rolldown issue #11397](https://github.com/rolldown/rolldown/issues/11397). A dynamic import was returning an extra export that the original module had never declared.

That gave me a reason to bring this chapter forward. Before thinking about a fix, I needed to understand why the bundler had generated that export in the first place.

In [the previous chapter](/posts/feopack-incremental-builds/), incremental `make` reached a small but useful milestone: Feopack could invalidate affected modules, rebuild them, and reuse an unaffected part of the module graph.

`seal()` still ran from scratch, and the chapter ended by looking ahead to HMR.

This time, I want to return to `seal()` instead.

Back when [Feopack first produced a working bundle](/posts/feopack-from-source-to-bundle/), we introduced a `ChunkGraph`, but its construction was deliberately simple:

```rust
let module_ids = self.module_graph.module_ids().cloned().collect();

let chunk = Chunk {
  id: "main".to_string(),
  module_ids,
};
```

Every discovered module went into `main`. The runtime then gave each module its own exports object and let other modules access it through `__feopack_import__(moduleId)`.

That remains the basic arrangement in [Feopack's chunk construction](https://github.com/atom-universe/feopack/blob/main/crates/feopack-core/src/compiler/compilation/seal/chunk_graph.rs).

Several modules could already share a dependency. So why would another bundler need to generate this?

```js
export { messages as t };
```

What did that extra export do that Feopack's module table did not?

To answer that, let's give the dependency graph more than one output chunk. This will explain one concrete case rather than every rule in Rolldown's chunking algorithm.

Suppose our source contains these three modules:

```js
// messages.js
export const messages = { title: 'Hello' };

// form.js
import { messages } from './messages.js';

export function renderForm() {
  return messages.title;
}

// page.js
import { messages } from './messages.js';

export function renderPage() {
  return messages.title;
}
```

The application loads the form and page through separate dynamic imports.

The first layout I imagined was a dedicated shared chunk. Instead of drawing the connections, let's write out the files the browser would load.

These are simplified output examples, with readable filenames. They illustrate two possible layouts rather than the exact output of a particular configuration.

**Layout 1: put the shared value in its own file**

```js
// shared-chunk.js
const messages = { title: 'Hello' };

export { messages };
```

```js
// form-chunk.js
import { messages } from './shared-chunk.js';

function renderForm() {
  return messages.title;
}

export { renderForm };
```

```js
// page-chunk.js
import { messages } from './shared-chunk.js';

function renderPage() {
  return messages.title;
}

export { renderPage };
```

Both imports point to the same `shared-chunk.js` module. The `messages` object is created there once, and both functions read that same object. Sharing does not mean copying the declaration into both files.

**Layout 2: put the shared value beside one of its consumers**

The bundler could instead put `messages.js` and `form.js` into one output file. There is no separate `shared-chunk.js` in this layout:

```js
// form-chunk.js
const messages = { title: 'Hello' };

function renderForm() {
  return messages.title; // Same file: use the binding directly.
}

// Another chunk still needs messages, so expose it as t.
export { renderForm, messages as t };
```

```js
// page-chunk.js
import { t as messages } from './form-chunk.js';

function renderPage() {
  return messages.title;
}

export { renderPage };
```

In the second layout, `renderForm` reads the local `messages` binding directly. Only `page-chunk.js` needs the extra export. The name `t` could just as well be `messages`. Both functions would still read the same object.

The dependency graph and chunking rules determine the actual layout.

At this point, a natural question is whether users can influence those decisions. They can: Rolldown's [`output.codeSplitting`](https://rolldown.rs/in-depth/manual-code-splitting) option provides manual grouping rules, including ways to select modules for named chunks.

There is also a related decision: what may an entry chunk expose after modules have been grouped together?

That is what [`preserveEntrySignatures`](https://rolldown.rs/reference/InputOptions.preserveEntrySignatures) controls. *Preserve* means to keep something intact; here, the entry signature is its public export interface.

| Setting | Policy for entry exports |
| --- | --- |
| `'strict'` | Keep the original exports exactly, without additional internal exports. |
| `'allow-extension'` | Keep the original exports, but allow additional exports. |
| `'exports-only'` | Use strict behavior for entries with exports; allow extension for entries without exports. This is the default. |
| `false` | Do not require the entry's original export interface to be retained. |

For example, a configuration can request a strict entry interface:

```js
export default {
  input: 'src/main.js',
  preserveEntrySignatures: 'strict',
  output: {
    dir: 'dist',
    format: 'esm',
  },
};
```

The distinction matters: chunk grouping controls where modules go; signature preservation constrains what entry consumers can see. The latter can require a forwarding chunk, but it does not directly select one of our two layouts.

Nor does setting it to `'strict'` fix every namespace bug, as the reported dynamic-import case will show.

This was where my Feopack comparison had been misleading me. Feopack already had a communication mechanism: its runtime looked up a module by ID and returned that module's exports.

In this ESM output, native imports and exports connect the output files.

<code-flow id="module-table-vs-esm" class="binding-map mermaid-pixel-frame" data-diagram-label="Module table vs ESM">
<figure>
<figcaption>How does <code>page.js</code> reach <code>messages</code>?</figcaption>
<section class="lookup-lane" data-runtime="feopack">
<header><small>01 / Feopack</small><strong>Look up a module by ID</strong></header>
<div class="lookup-route">
<div class="lookup-card"><small>Consumer · page.js</small><pre><code>const { <b>messages</b> } =
  __feopack_import__(id);</code></pre></div>
<svg class="lookup-arrow" aria-hidden="true" viewBox="0 0 32 16"><path d="M1 8h28m-7-6 7 6-7 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
<div class="lookup-card"><small>Runtime · messages.js</small><p>The runtime returns the cached exports object for <code>id</code>. The consumer reads its <code><b>messages</b></code> property.</p></div>
</div>
</section>
<section class="lookup-lane" data-runtime="esm">
<header><small>02 / Native ESM</small><strong>Import a binding by name</strong></header>
<div class="lookup-route">
<div class="lookup-card"><small>Consumer · page-chunk.js</small><pre><code>import { <em>t</em> as <b>messages</b> }
  from './form-chunk.js';</code></pre></div>
<svg class="lookup-arrow" aria-hidden="true" viewBox="0 0 32 16"><path d="M1 8h28m-7-6 7 6-7 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
<div class="lookup-card"><small>Provider · form-chunk.js</small><pre><code>export { renderForm,
  <b>messages</b> as <em>t</em> };</code></pre></div>
</div>
</section>
</figure>
</code-flow>

Both arrangements let consumers access a shared dependency. They preserve module boundaries in different ways.

It also helped to locate this work inside the compiler. Feopack's `seal()` builds the chunk graph and generates assets.

Rolldown's [`GenerateStage`](https://github.com/rolldown/rolldown/blob/2a53ec71548752402c3db1c0435cdd32fdf1131d/crates/rolldown/src/stages/generate_stage/mod.rs) has broadly similar responsibilities, with considerably more analysis and planning between those steps.

The name `GenerateStage` initially made me think mainly of printing code. But deciding which bindings must cross chunk boundaries is part of preparing that code. Once the compiler has placed modules into chunks, it must rebuild the connections that the new layout requires.

The source imports describe relationships between source modules. The generated imports describe relationships between output chunks.

Those relationships do not have to correspond one-to-one.

That explains why the extra export exists. It does not yet explain the bug.

In our simplified example, an application importing the original form module expects this:

```js
const form = await import('./form.js');

Object.keys(form);
// ['renderForm']
```

If the bundler rewrites that call directly to the combined chunk:

```js
const form = await import('./form-chunk.js');
```

the JavaScript engine sees the exports of the file it actually loads:

```js
Object.keys(form);
// ['renderForm', 't']
```

It has no knowledge of the original boundary between `messages.js` and `form.js`. Both names are exports of `form-chunk.js`.

The real Rolldown report followed this pattern. A form module and its translation dependency ended up in one chunk, while another chunk needed the translations.

The generated chunk exposed an internal alias, and a bare dynamic import returned that alias alongside the form's public exports.

This mattered because the application enumerated the imported namespace and interpreted its exports as form definitions. An internal binding became an unexpected application value.

The issue included a reproduction using default options in Rolldown 1.2.16; explicitly setting `preserveEntrySignatures: 'strict'` still exposed the extra export.

This was not a case of the user opting into `'allow-extension'`. [Original report and reproduction](https://github.com/rolldown/rolldown/issues/11397)

The internal export itself had a legitimate purpose. Removing it would break the other chunk's access to the shared value.

What needed protection was the interface returned to the dynamic importer.

This brings us back to the entry-signature policies from earlier. The distinction between a chunk's internal communication needs and an entry's public interface is now visible in the generated code.

An output chunk may need additional exports for communication. That does not automatically make those names part of the original module's public interface.

There are different ways to maintain that distinction.

In the issue's comparison, Rollup kept a representation of the original module's namespace inside the chunk and rewrote the dynamic import to select it:

```js
// Conceptual shape; names simplified.
import('./form-chunk.js').then(chunk => chunk.formNamespace);
```

The report also showed that Rolldown already used namespace extraction for some other dynamic-entry layouts. This case did not take that path.

Another approach is a small forwarding module, often called a *facade*. Here is the layout I tried in the reproduction.

<code-flow class="mermaid-pixel-frame" data-diagram-label="Entry facade">
<figure>
<figcaption>Two readers of the same chunk</figcaption>
<div class="flow-grid">
<div class="flow-node flow-public">
<strong>form-entry.js</strong><br/>The application loads this facade with <code>import()</code>.

```js showLineNumbers=false
export { renderForm }
  from './form-chunk.js';
```

</div>
<div class="flow-node flow-internal">
<strong>page-chunk.js</strong><br/>The page reads the shared translations.

```js showLineNumbers=false
import { t as messages }
  from './form-chunk.js';
```

</div>
<div class="flow-edge">Facade re-exports <code>renderForm</code><svg viewBox="0 0 16 24" aria-hidden="true"><path d="M8 1v20m-6-7 6 7 6-7" fill="none" stroke="currentColor" stroke-width="2"/></svg></div>
<div class="flow-edge">Page imports <code>t</code><svg viewBox="0 0 16 24" aria-hidden="true"><path d="M8 1v20m-6-7 6 7 6-7" fill="none" stroke="currentColor" stroke-width="2"/></svg></div>
<div class="flow-node flow-output">
<strong>form-chunk.js</strong><br/>Both readers get their bindings from this file.

```js showLineNumbers=false
export { renderForm, messages as t };
```

</div>
</div>
</figure>
</code-flow>

I tried this in a patch that reused Rolldown's existing entry facades. In the reproduction, the extra file kept `t` out of the form namespace and preserved live bindings. Rollup produced the expected namespace in three files, while my patch produced four.

> **Update (November 2, 2026).** My PR was closed after the maintainer found regressions in CommonJS interop and module execution order. One generated CommonJS facade even tried to read a variable declared in a different file. I’m still glad I took this step. I went from puzzling over an extra `t` to writing a patch, and the review gave me concrete cases to learn from. [Maintainer feedback on PR #11412](https://github.com/rolldown/rolldown/pull/11412#issuecomment-6569085179)

Feopack's single-chunk runtime let me postpone these questions. Reading the Rolldown issue made them concrete: after modules are placed into separate output files, the compiler needs to connect those files while preserving the interfaces that source-level imports refer to.

For this chapter, I wanted to understand that boundary through an existing bundler. In the next chapter, I'll return to Feopack and explore a minimal code-splitting implementation of our own.
