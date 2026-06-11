---
title: "Feopack: Loaders"
published: 2026-05-19
description: "A working research note for extending Feopack with a more complete loader pipeline"
image: ''
tags: [Rust, Bundler, Rspack, Webpack, Plugin]
category: Projects
draft: true
lang: en
---

## Why am I doing it?

Several weeks ago, I planed to spend some focused time building Feopack's loader system.

> BTW, why was I suddenly working on feopack again?
> Maybe some people were too harsh about how rarely I update my blog.
> Well, let me try to do it better than annually :D

Before jumping into the deep end of loaders, I wanted to learn from a better design first, and Rspack is the good reference, and actually Feopack is the simplified version of that. Otherwise my own design might end up being too wild and crazy to be accepted by the industry.

In my past blog, Feopack already had the rough build lifecycle: `make`, `seal`, and `emit`. That is enough to explain the skeleton of a bundler, but that's not cool enough.

The next missing piece is not a more clever chunk algorithm yet. It is the ability to take a file that is not plain JavaScript, run it through a small transformation pipeline, and let the rest of the compiler treat the result as a normal module.

That is what loader expected to do. 

Here is the story line I plan to write, and I will tell my understanding about loaders in the order:

> It could change because it's just a draf at yet

```
1. Why loader should come before a plugin system in Feopack.
2. Where loader execution belongs in the build pipeline.
3. What Rspack roughly does, without trying to copy every historical detail.
4. What a minimal Feopack loader runner should look like.
5. How a text loader can prove the pipeline works.
6. Why `pitch`, resource queries, and virtual modules exist.
7. What I should deliberately not build yet.
```

## About loaders, all you need to know.

### So, what are loaders?

In the `make -> seal -> emit` lifecycle, loaders belong to `make`.

They sit inside the module build step. The compiler resolves a request, reads the resource, applies matching loaders, and only then parses the transformed source as a module.

```mermaid
flowchart LR
  Entry["【Entry】<br/>src/index.js"]

  subgraph MAKE["Make"]
    direction TB
    Resolve["【Resolve Request】<br/>./message.txt"]
    Read["【Read Resource】<br/>raw source"]
    Loaders["【Run Loaders】<br/>source -> JS module"]
    Parse["【Parse Module】<br/>AST + dependencies"]
    ModuleGraph["【ModuleGraph】<br/>modules + dependency edges"]

    Resolve --> Read
    Read --> Loaders
    Loaders --> Parse
    Parse --> ModuleGraph
  end


  Entry --> Resolve

  style Loaders fill:#eef2ff,stroke:#8b5cf6,stroke-width:2px,color:#1f2937
```

So a loader is not a late code generation trick. It is part of building a module.

Loaders run when the compiler resolves a `module request`.

> What the module request is?
> Generally, it comes from the `import`(or `request`, the below are the same so) in entry files.
> When we start to resolve a `import`, it generates a `module request`. 
> And in some conditions, loaders can make a `import` several ones, which will get talked over in below part. 

To make that concrete, suppose we have a text file that starts as raw text:

```txt
hello loader
```

Out of the box, importing a `.txt` file directly in JavaScript does not work.
But with a loader, we can make it possible:

```js
import txt from './hello.txt'

console.log(txt) // "hello loader"
```

The idea itself is simple. Since the whole process runs inside Rust or Node.js, the compiler can read the `.txt` file, get its content, and transform that content into JavaScript source code.

```rs
pub struct LoaderRule {
  pub test: String,
  pub used_loaders: Vec<String>,
}

// context = readFile('./hello.txt')
pub fn text_loader(context: LoaderContext) -> Result<String, String> {
  Ok(format!("export default {:?}", context.source))
}
```

The loader turns the text file into a JavaScript module. You can think of that generated module as a virtual file whose content looks like this:

```js
export default 'hello loader'
```

So finally, JavaScript can import and consume it like a real module file.


> Actually, this is not exactly how my current implementation transforms the code.
> I first tried to do it through SWC, but SWC does not give me a convenient helper for this specific rewrite.
> And yes, I am lazy, so I changed the loader implementation itself instead.
> That is not a big deal though. The text above still explains the mechanism well.

### How do we register a loader?

In Rspack (and Webpack, which keeps the same config shape), we register loaders through `module.rules`. A minimal case for the `.txt` demo above looks like this:

```ts
// webpack.config.ts
import type { Configuration } from 'webpack'

export default {
  entry: './src/index.js',
  module: {
    rules: [
      {
        // When the request ends with .txt, run the loader chain.
        test: /\.txt$/i,
        use: [
          {
            // Resolve a custom loader from disk.
            loader: './loaders/text-loader.js',
          },
        ],
      },
    ],
  },
} 
```

The same idea also works with the shorthand array form you often see in docs:

```ts
module: {
  rules: [
    {
      test: /\.txt$/i,
      use: ['./loaders/text-loader.js'],
    },
  ],
},
```

Rspack's implementation is much more layered than Feopack needs to be right now. At this early stage, I chose to start with built-in loaders, which live in the Rust part instead of a `module.rules` table on the JavaScript side.

In Feopack, the loaders are registered when a new compilation starts:

```rs
impl Compilation {
  pub fn new(options: CompilationOptions) -> Self {
    let mut loader_registry = LoaderRegistry::new();
    // give a name to the loader, and then we can use the name as a symbol of it
    loader_registry.register_loader("my-honey-text-loader".to_string(), text_loader);
    loader_registry.add_rule(LoaderRule {
      test: ".txt".to_string(),
      // the name gets used here :D
      used_loaders: vec!["my-honey-text-loader".to_string()],
    });
  }

  // ...
}
```

### When do loaders run?

When `src/index.js` contains `import txt from './hello.txt'`, the compiler does not parse the raw text file as JavaScript. It matches this rule, runs `text-loader`, and only then feeds the loader output to the parser.

> You can see that in the mermaid diagram above.


## Building a better Loader System

> Virtual Request
> Pitcher

### Virtual request

First, define a rule structure:

```rust
pub struct LoaderRule {
  pub test: String,
  pub used_loaders: Vec<String>,
}
```

Second, define a loader registry:

```rust
pub type Loader = fn(resource_path: &Path, source: String) -> Result<String, String>;
```

Third, a runner:

```txt
find first matching rule
run its loaders from right to left
return transformed source
```

The right-to-left detail follows webpack's normal loader convention. If the rule is:

```txt
use: ["style-loader", "css-loader"]
```

then `css-loader` handles the source first, and `style-loader` consumes the JavaScript produced by `css-loader`.

Feopack does not need all of that for a text loader, but keeping the direction correct now avoids building a backwards mental model.

## The text loader as the first proof

The first useful loader does not need to be clever.

It can take this file:

```txt
hello loader
```

and turn it into this module:

```js
const __feopack_text__ = "hello loader";
export default __feopack_text__;
```

Then user code can write:

```js
import message from "./message.txt";

console.log(message);
```

This test proves several things at once:

1. Feopack can resolve a non-JavaScript resource.
2. The loader can transform raw file content into JavaScript.
3. Dependency scanning happens after loader transformation.
4. Code generation can bundle the transformed module result.

That is a small feature, but it touches the real compiler path. This is exactly the kind of TDD case I like for Feopack: tiny surface area, real architectural pressure.

## Where should the loader result live?

Right now, the temptation is to add a field wherever it is convenient.

That is fine for a first spike, but the more Rspack-shaped answer is that module build output should belong to the module's build state.

A source file goes through several identities:

```txt
raw resource on disk
  -> loaded source
  -> transformed source
  -> parsed module
  -> codegen-ready module
  -> rendered asset fragment
```

These are not all the same thing.

If Feopack stores only the original file path and keeps recomputing everything from disk, later phases become harder to reason about. If Feopack stores one giant `module_result` field on `Compilation`, the system works for a while but starts to feel like a drawer full of unlabelled cables.

The next improvement should probably be a clearer module build result:

```rust
pub struct ModuleBuildResult {
  pub original_source: String,
  pub transformed_source: String,
  pub dependencies: Vec<RawDependencyRecord>,
}
```

This is still not a production design. It is just enough structure to say: `make` owns module building, `seal` consumes the module graph, and code generation consumes already-built module data.

That separation matters more than the exact struct name.

## What about resource queries?

This is where things become interesting.

A real loader system does not only deal with plain file paths. It often deals with requests that include query-like metadata:

```txt
./App.vue?type=template
./App.vue?type=script
./App.vue?type=style&index=0
```

At first this looks like a hack. Then it starts to look like a very useful hack.

The same physical file can produce several logical modules. A Vue single-file component is the classic example: one `.vue` resource can be split into script, template, and style parts. Each part may then go through a different loader pipeline.

For Feopack, I probably do not need a complete Vue loader. But I do want the data model to leave room for this shape:

```rust
pub struct ModuleRequest {
  pub resource_path: PathBuf,
  pub query: Option<String>,
}
```

That one extra `query` field may be enough for a learning implementation. It lets Feopack distinguish `App.vue` from `App.vue?type=template` without pretending they are the same module.

## What is pitch?

todo!()

## Virtual modules and child requests

todo!()

## Loader context APIs

todo!()

## Source maps and caching

todo!()

## The MVP I actually want

The next Feopack target should stay small:

1. Register loader rules from options.
2. Match a resource by suffix.
3. Run loaders during module build in `make`.
4. Store the transformed source as module build output.
5. Parse dependencies from transformed source.
6. Add one playground case for importing text.

After that, I can decide whether the next chapter should be about `pitch`, resource queries, or the plugin system.

For now, the rule is simple: make the compiler learn one small trick, then explain why that trick belongs in the architecture.
