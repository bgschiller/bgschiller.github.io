---
title: Vue Browser Extensions with Parcel
category: blog
date: 2020-11-17
description: Use parcel to build a browser extension with Vue
tags: [programming, web, vue, parcel]
---

Vue CLI offers a great workflow for most web apps. Run a command, choose which plugins to enable, and you're off to the races. But if you want something off the beaten path it is a little more difficult. I've found that setting up webpack takes longer than I'm willing to spend for a quick project. Instead, I use Parcel, which requires (almost) zero config.

Today we'll walk through how to use Vue (or React, or Typescript, or anything else that needs a build step) in a Browser Extension. Our browser extension will work in both Chrome and Firefox (using the webextension-polyfill project).

The hard part, as it should be, is deciding what to build. We'll punt on that one, and just make a widget that shows a color depending on the date.

To get started, initialize your project and install a couple dependencies.

```bash
npm init -y # set up a package.json, accepting all default
# (drop the '-y' if you want to choose a name, license, etc, by hand)
npm install --save-dev parcel parcel-plugin-web-extension
```

Next, borrow a couple of scripts we'll need for building the release: [scripts/remove-evals.js](https://github.com/bgschiller/vue-parcel-web-extension/blob/main/scripts/remove-evals.js) and [scripts/build-zip.js](https://github.com/bgschiller/vue-parcel-web-extension/blob/main/scripts/build-zip.js). I originally got these from another boilerplate, but made some changes to remove dependencies. It looks like remove-evals.js is used because chrome extensions ship with a content-security-policy that disallows `eval`. build-zip.js is used to package up a production build of your extension.

Next, we'll make a manifest file, describing the extension's entry points. Our extension is fairly simple with only a popup, but yours might have content scripts, a background script, or an options page.

```json
{
  // src/manifest.json
  "browser_action": {
    "default_popup": "./popup.html"
  },
  "description": "Color of the Day",
  "manifest_version": 2,
  "name": "color-of-the-day",
  "permissions": [],
  "version": "1.0.0",
  "content_security_policy": "script-src 'self' 'unsafe-eval'; object-src 'self'"
}
```

Next, make a small file matching your `default_popup`'s name: `popup.html`. This will be used as a parcel entry point, so parcel will bundle any resources it finds in this file.

```html
<!-- src/popup.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
  </head>

  <body>
    <div id="app"></div>
    <script src="./popup.js"></script>
  </body>
</html>
```

When parcel sees `<script src="./popup.js"></script>`, it will visit _that_ file to see what other code needs to be bundled. That will be our Vue entry point.

```js
// src/popup.js
import Vue from "vue";
import App from "./App.vue";

new Vue({
  el: "#app",
  render: (h) => h(App),
});
```

Similarly, parcel will now pull in both `vue` and `App.vue`.

```vue
<template>
  <div
    class="color-of-the-day"
    :style="{ 'background-color': backgroundColor }"
  ></div>
</template>
<script>
export default {
  computed: {
    hue() {
      return Math.floor(Math.random() * 360);
    },
    backgroundColor() {
      return `hsl(${this.hue}, 100%, 50%)`;
    },
  },
};
</script>
<style>
.color-of-the-day {
  width: 200px;
  height: 200px;
}
</style>
```

Finally, we'll need to add a few items to the scripts section of our package.json:

```js
{ // package.json
  // ...
  "scripts": {
    "build": "npm run pack && npm run remove-evals && npm run zip",
    "dev": "parcel watch src/manifest.json --out-dir dist --no-hmr",
    "pack": "parcel build src/manifest.json --out-dir dist",
    "remove-evals": "node scripts/remove-evals.js",
    "zip": "node scripts/build-zip.js"
  }
  // ...
}
```

Now run `npm run dev` to build your extension. The first time you run this, parcel will notice you're working with Vue and download some packages you need (eg, `vue`, `vue-template-compiler`). Once it says "Built in 14.03s", or however long, you can load the extension in your browser.

Visit `chrome://extensions` or `about:debugging#/runtime/this-firefox`, depending on your browser. You may need to turn on developer mode if this is the first time you've loaded an extension from a file on this computer. Load the `dist` folder (chrome) or the manifest.json file (firefox), and your extension is ready!

![The popup of the 'color of the day' browser extension](./color-of-the-day.png)

All the code from this post is available at https://github.com/bgschiller/vue-parcel-web-extension

## More goodies

Parcel is smart enough to handle almost any web technology. If you want to use Typescript, just change
`popup.js` to `popup.ts` and make a tsconfig.json file. Want to use scss? Add `lang="scss"` to the `<style>` tag in your Vue component. Reportedly, it can even handle Rust code, though I haven't tried it.
