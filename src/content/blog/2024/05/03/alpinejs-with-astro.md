---
date: 2024-05-03
title: "Using Alpine.js with Astro View Transitions"
description: "Astro View Transitions can break Alpine.js components. Here's how to fix it."
---

I'm in the process of moving my blog from Jekyll over to Astro. In the process, I wanted to spruce up a couple of posts that had interactive elements. With Jekyll, I used iframes or jQuery to handle the interactivity. Jekyll doesn't make it easy to include page-specific JavaScript in a markdown post, so I had to get creative (also, it was 2013 and I didn't know what I was doing).

Astro makes it easy to include interactive components in markdown posts. I decided to use Alpine.js to replace the messy jQuery on [Putnam Boxes and Balls](/blog/2013/09/19/putnam-boxes) and [Grading on a Curve](/blog/2013/11/10/grading-curve).

For simple components, many people define their state inline in an HTML attribute:

```html
<div x-data="{ count: 0 }">
  <button @click="count++">Increment</button>
  <span x-text="count"></span>
</div>
```

For bigger things, it's also common to move the definition into a script tag or JS file. There are several benefits to this: you can import other modules, re-use the same component in multiple places, use TypeScript and syntax highlighting, etc. Here's an example:

```html
<div x-data="searchableUsers()">
  <input x-model="search" />
  <ul>
    <template x-for="item in filteredItems" :key="item.id">
      <li x-text="item.name"></li>
    </template>
  </ul>
</div>

<script type="text/javascript">
  function searchableUsers() {
    return {
      search: "",
      items: [
        { id: 1, name: "Tenzing Norgay" },
        { id: 2, name: "Lionel Terray" },
        { id: 3, name: "Alexander Honnold" },
      ],
      get filteredItems() {
        const query = this.search.toLowerCase();
        return this.items.filter((item) =>
          item.name.toLowerCase().includes(query),
        );
      },
    };
  }
</script>
```

Unfortunately, this practice causes problems with Astro's View Transitions. With View Transitions turned on, Astro doesn't reload the page when you navigate to a new page. Instead, it fetches the new content and replaces the old content. Here's how things look in the context of a page with an Alpine.js component:

1. You arrive at a page, maybe the index page, and `Alpine.start()` is called. Now Alpine is watching the DOM for `x-data` attributes.
2. You navigate to a new page. Astro fetches the new content and replaces the old content. If the new content has any `x-data` attributes, Alpine evaluates renders them.
3. The new page's JavaScript is loaded and executed.

If all your Alpine.js components are defined inline, you're fine. But if you define your components in a script tag or JS file, you'll hit two problems:

1. An `x-data="counter()"` attribute will be evaluated before the script tag is executed. This means that the `counter` function isn't defined yet, and Alpine will throw an error.
2. Once the script tag is executed, the `counter` function is defined. But Alpine doesn't re-evaluate the `x-data` attributes, so the component doesn't show up.

To fix these issues, I created a custom entrypoint for the Astro Alpine.js integration. The entrypoint defines a shared `Alpine.data()` object with a reactive property that updates on each page load. This clues Alpine in to re-evaluate the `x-data` attributes.

Here's the custom entrypoint:

```ts
// src/entrypoints/alpine.ts
import type { Alpine } from "alpinejs";

export default (Alpine: Alpine) => {
  // Access this data by using
  // `x-data="astro" x-bind="refreshOnPageLoad"`
  Alpine.data("astro", () => ({
    // re-evaluate expressions when the page loads by
    // including `pageLoaded` in the expression. For example,
    // `x-if="pageLoaded && typeof myComponent !== 'undefined'"`
    pageLoaded: 1,
    refreshOnPageLoad: {
      // This property is attached with the
      // `x-bind="refreshOnPageLoad"` directive
      ["@astro:page-load.document"]() {
        // Update pageLoaded to trigger a re-evaluation
        // of any Alpine.js expressions that depend on it.
        this.pageLoaded++;
      },
    },
  }));
  return Alpine;
};
```

And here's how you use it in context:

```html
// src/components/counter.astro
<div x-data="astro" x-bind="refreshOnPageLoad">
  <template x-if="pageLoaded && typeof counter !== 'undefined'">
    <div x-data="counter()">
      <button @click="increment()">Increment</button>
      <span x-text="count"></span>
    </div>
  </template>
</div>

<script type="text/javascript">
  function counter() {
    return {
      count: 0,
      increment() {
        this.count++;
      },
    };
  }
</script>
```
