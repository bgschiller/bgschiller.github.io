---
date: Apr 20, 2024
title: "vitest-unsettled"
repoURL: "https://github.com/bgschiller/vitest-matchers/tree/main/packages/unsettled"
description: "Custom matcher for checking if a Promise is settled (either resolved or rejected)."
---

Custom Vitest matcher for checking if a Promise is settled (either resolved or rejected).

If you expect a promise to be settled, you probably assert on its value: expect(p).resolves.toBe(value). But what if you want to assert that a promise is not settled? You can't do that with the built-in matchers.

```js
let resolve = null;
const p = new Promise((r) => {
  resolve = r;
});
await expect(p).toBeUnsettled(); // passes
resolve(12);
await expect(p).not.toBeUnsettled(); // passes
```
