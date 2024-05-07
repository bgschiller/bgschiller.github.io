---
title: Python-style Context Managers in JavaScript
category: blog
tags: [programming, javascript]
date: 2017-09-20
description: Python's context managers are a great feature. Here's how to approximate them in JavaScript.
---

A language feature that I really appreciate in Python is context managers. That's what the `with` keyword does-- it starts a new context, setting up code that will be called before and after a block of code. The most common use is with resources, like opening a file. Without it, you might write

```python
f = open('names')
names = f.readlines()
f.close()
```

However, being required to call functions in a particular order doesn't make for a nice interface. Plus, what if an exception happens between `open` and `close`? Using a context manager fixes both of these issues:

```python
with open('names') as f:
    names = f.readlines()
```

The file will be automatically closed when execution leaves the `with` block, even if it leaves by way of an exception.

In the project I'm working on right now, I had a pair of functions that always needed to be called in a particular order:

1. `components = componentsOnStory(...)` Record the position of all 'components'.
2. Now, the caller performs some action modifying the geometry of the story.
3. `replaceComponents(components, ...)` Put the components back in the correct positions.

This is another example of a less-than-ideal interface where two functions must be called in a particular order. Javascript doesn't have context managers, but we can approximate them with a function. Here's what I came up with.

```javascript
function withPreservedComponents(context, geometry_id, action) {
  const components = componentsOnStory(context.rootState, geometry_id);
  action();
  replaceComponents(context, components);
}
```

And here's what it looks like for the caller:

```javascript
function moveFaceByOffset(context, payload) {
  // ... some code omitted for brevity
  const movedPoints = verticesForFaceId(face.id, currentStoryGeometry).map(
      (v) => ({
        x: v.x + dx,
        y: v.y + dy,
      }),
    ),
    newGeoms = newGeometriesOfOverlappedFaces(
      movedPoints,
      // Don't consider face we're modifying as a reason to
      // disqualify the action.
      geometryHelpers.exceptFace(currentStoryGeometry, face_id),
    );

  // ... some code omitted for brevity

  withPreservedComponents(context, currentStoryGeometry.id, () => {
    newGeoms.forEach((newGeom) =>
      context.dispatch("replaceFacePoints", newGeom),
    );

    context.dispatch("replaceFacePoints", {
      geometry_id: currentStoryGeometry.id,
      face_id,
      vertices: movedGeom.vertices,
      edges: movedGeom.edges,
      dx,
      dy,
    });
  });
}
```

I feel like this is an improvement, because the caller is no longer responsible for remembering to call the `replaceComponents` function. The api of the library is smaller -- I'm now only exporting the one `withPreservedComponents` function.
