---
title: Sketch Playground
published: 2026-06-28
draft: true
description: Permanent draft playground for build-time sketch rendering.
tags:
  - sketch
category: demo
---

This post is intentionally kept as `draft: true`. It is a permanent playground for testing sketch blocks without publishing them.

## Sidecar Sketch

:::sketch{src="../../assets/sketches/sketch-playground/loader-flow.sketch.json" alt="Sketch playground diagram"}
:::

## Inline Sketch

```sketch
{
  "version": 1,
  "width": 640,
  "height": 260,
  "background": "#ffffff",
  "elements": [
    {
      "type": "highlight",
      "color": "#fde047",
      "size": 18,
      "points": [[74, 78], [220, 78], [360, 82]]
    },
    {
      "type": "text",
      "x": 72,
      "y": 58,
      "text": "inline sketch",
      "color": "#334155",
      "size": 28
    },
    {
      "type": "arrow",
      "x1": 96,
      "y1": 150,
      "x2": 500,
      "y2": 150,
      "color": "#7c3aed",
      "size": 5
    }
  ]
}
```

## TODO

- Explore whether build-time raster images are only the first delivery mode, not necessarily the optimal final one.
- Consider a hybrid renderer: keep freehand/background strokes as an image, but render text as DOM positioned over the image. This could reduce image size and keep text crisp/selectable.
- Consider extracting rule-based shapes or diagram primitives into SVG/DOM layers instead of baking every element into one raster output.
- Consider optional draggable “regular components” in the editor, such as boxes, arrows, labels, lanes, callouts, or SVG-backed diagram widgets.
- Treat this as brainstorming for now; do not overfit the current implementation before real blog usage shows which paths matter.
