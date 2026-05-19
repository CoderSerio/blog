---
title: "Feopack: Notes on Loaders, Hooks, and Plugin Architecture"
published: 2026-05-19
description: "A working research note for extending feopack with a more complete loader pipeline and hook-based plugin system."
image: ''
tags: [Rust, Bundler, Rspack, Webpack, Plugin]
category: Projects
draft: true
lang: en
---

This week I want to spend some focused time on feopack's loader and plugin system.

The first version of feopack was mostly about proving that the core bundling path works: resolve modules, build a module graph, transform code, generate chunks, and emit assets. That was enough for a small bundler experiment, but it also made the missing pieces more obvious.

If feopack is going to become a more complete learning project, the next useful step is not adding more syntax support at random. It is building the extension points carefully enough that future features can plug into the compiler instead of being hard-coded into it.

## The Goal

The goal is to design two related systems:

- A loader pipeline for transforming module sources.
- A hook-based plugin architecture for extending compiler behavior.

Loaders should answer the question:

> How does one module's raw source become the JavaScript or asset representation that the bundler understands?

Plugins should answer the question:

> How can external code participate in compiler lifecycle events without modifying compiler internals?

These two systems overlap, but they should not become the same abstraction. A loader is usually local to a module transformation. A plugin is usually global to the compilation lifecycle.

## Loader Pipeline

The loader system needs to cover the basic webpack-like mental model:

```ts
module.rules = [
  {
    test: /\.css$/,
    use: ["style-loader", "css-loader"],
  },
];
```

For feopack, I want to keep the first version narrower:

- Match rules by resource path.
- Run matched loaders in a deterministic order.
- Pass loader output into the module parser.
- Allow loaders to return transformed source and optional metadata.
- Keep source map support in mind, even if the first version does not fully implement it.

The main design question is where the JavaScript-facing loader API ends and where the Rust compiler core begins.

Because feopack uses a Rust core with a JavaScript wrapper, every cross-boundary call has a cost. A naive implementation that calls back into JavaScript for every tiny step may be easy to write, but it would also erase part of the reason for using Rust in the first place.

So the loader pipeline probably needs two layers:

- A JavaScript configuration layer that describes loader rules.
- A Rust execution layer that receives normalized loader tasks and runs the module build pipeline.

If custom JavaScript loaders are supported, they may need to run through a controlled async bridge. That bridge should be explicit instead of hidden inside the module graph builder.

## Hook System

For the plugin system, the obvious reference is webpack's `Tapable`, but copying it directly would be the wrong goal.

What I want from hooks:

- A small set of compiler lifecycle points.
- Predictable ordering.
- Clear sync or async behavior.
- Typed hook payloads on the Rust side.
- A JavaScript plugin API that feels familiar enough to use.

The first hook list can stay small:

```text
beforeRun
run
beforeCompile
compile
thisCompilation
compilation
make
seal
emit
done
```

That is already enough to model many useful behaviors:

- Inspecting compiler options.
- Adding virtual modules.
- Modifying assets before emit.
- Collecting build stats.
- Reporting warnings and diagnostics.

The hard part is deciding which hooks should be stable public API and which ones are only internal implementation details.

## Plugin Shape

The JavaScript-facing plugin API can probably start with the familiar `apply` shape:

```ts
class ExamplePlugin {
  apply(compiler) {
    compiler.hooks.done.tap("ExamplePlugin", (stats) => {
      console.log(stats);
    });
  }
}
```

That does not mean feopack has to clone webpack's whole hook model. It just means the entry point is familiar.

Internally, I need to answer:

- Are hooks owned by the JavaScript wrapper, Rust compiler, or both?
- Does Rust call JavaScript hooks directly during compilation?
- Do plugin effects become serialized commands passed back into Rust?
- How should async hooks interact with parallel module building?

My current bias is to keep lifecycle orchestration explicit. The compiler should know when it is crossing the JS/Rust boundary, and the hook system should not make that invisible.

## First Implementation Slice

The first useful slice could be:

1. Add normalized rule matching for loaders.
2. Support a simple text loader transform.
3. Add compiler hooks for `beforeRun`, `make`, `emit`, and `done`.
4. Expose a minimal JavaScript plugin API.
5. Write one real plugin that prints build stats.
6. Write one real loader that transforms a non-JS asset into a JS module.

That would be enough to validate the shape without pretending to be webpack-compatible.

## Open Questions

- Should loaders be JavaScript functions, Rust-native transforms, or both?
- How much of webpack's loader context should be supported?
- Should hooks be sync-first, async-first, or split by lifecycle?
- How should plugin errors be represented in diagnostics?
- Can plugins safely mutate compilation state, or should they return commands?
- What is the minimum useful source map story?

## Research Targets

Things worth reading again before implementing:

- webpack loader runner behavior.
- webpack `Tapable` hook types.
- Rspack plugin architecture.
- Rolldown and Vite plugin pipeline boundaries.
- NAPI async task patterns for JS/Rust interop.

The point is not to reproduce any of them exactly. The point is to understand what problems they solved, then choose a smaller version that fits feopack.

## Notes

This post is a working note. The final write-up should probably include diagrams of the module build path and compiler lifecycle once the design is less hand-wavy.
