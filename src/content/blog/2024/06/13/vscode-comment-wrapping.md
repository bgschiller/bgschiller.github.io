---
date: 2024-06-13
title: "Fix line breaks in comments with VS Code Rewrap"
description: "VS Code Rewrap is a handy extension for wrapping long comments in your code."
---

Sometimes I'll write a real novel of a comment in my code. I try to keep to a 100-character limit, and prettier keeps my code looking nice, but it doesn't touch the comments. I try to manually wrap the comments, but it's tedious to pick the right spot to break the line. The worst is making a change in the middle of a comment and having to fix up every subsequent line.

Today, I had time to google if there's a better option, and found [VS Code
Rewrap](https://marketplace.visualstudio.com/items?itemName=stkb.rewrap). You can highlight a section and then run the Rewrap command from the command pallette. It will fix up the line breaks for you, inserting comment characters at the correct spot.

Before,

```js
// In our case, we don't want to consider the mouse to have
// left the clickable region when the user is still hovering over it. If we did, we'd stop
// capturing mouse clicks and the user wouldn't be able to interact with this element. To
// work around this, we check if the mouse is still inside the clickable element before
// releasing the mouse events and allowing the webview to be clicked-through again.
```

After,

```js
// In our case, we don't want to consider the mouse to have left the clickable region when the
// user is still hovering over it. If we did, we'd stop capturing mouse clicks and the user
// wouldn't be able to interact with this element. To work around this, we check if the mouse is
// still inside the clickable element before releasing the mouse events and allowing the webview
// to be clicked-through again.
```

It's a small thing, but it's nice to avoid drudgery when you can.

I also have this problem when I'm writing commit messages, which I mainly do in vim. You can rewrap the whole file in vim by running `gg` to get to the start of the file, then `gqG` to rewrap until `G` (the end of the file). You can also rewrap a selection by using `V` and then movement commands, then `gq` when you've selected the lines you want.
