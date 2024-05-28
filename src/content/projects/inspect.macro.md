---
date: Feb 3, 2019
title: "inspect.macro"
repoURL: "https://github.com/bgschiller/inspect.macro"
---

Babel plugin macro for loggin an expression and the result of that expression. Transforms

```js
import inspect from "inspect.macro";

inspect(complicatedExpression(involving.many(parts * and * values)));
```

into

```js
console.log(
  "complicatedExpression(involving.many(parts * and * values)) →",
  (function () {
    try {
      return complicatedExpression(involving.many(parts * and * values));
    } catch (e) {
      return "an error occurred: " + e;
    }
  })(),
);
```
