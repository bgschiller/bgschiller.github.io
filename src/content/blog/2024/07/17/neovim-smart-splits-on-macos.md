---
date: 2024-07-17
title: "Neovim smart-splits on macOS"
description: "Setting up neovim smart-splits with kitty on macOS"
---

Every couple of years I make an attempt at using vim as my primary editor. Usually, I fall off after a few days, but I'm going on two weeks now and I'm starting to think it might stick this time. I'm using the [LazyVim](https://www.lazyvim.org/) distribution, which I'm finding both intuitive and well-documented. I also want to give kudos to Dusty Phillips, whose book [LazyVim for Ambitious Developers](https://lazyvim-ambitious-devs.phillips.codes/) has been extremely helpful.

One thing I find particularly cool about my current setup is `smart-splits`. This is a neovim plugin that cooperates with the terminal emulator to use the same keyboard shortcuts to move between vim windows and terminal splits. So, if I press `Ctrl+h` in vim, I'll move to the next pane to the left—regardless of whether that's another vim window or a terminal split.

This has been the hardest plugin to get working so far, so I thought I'd document the process in case it helps someone else. We're using the following setup:

- macOS
- [kitty](https://sw.kovidgoyal.net/kitty/) terminal emulator
- [LazyVim](https://www.lazyvim.org/) distribution (which uses neovim)

Some of this might still apply if you're using Wezterm or tmux, but I haven't tried it.

## Step 1: Install the plugin

Create a new lua file in your `~/.config/nvim/lua` directory. I called mine `smart-splits.lua`. Add the following code:

````lua
```lua
return {
  "mrjones2014/smart-splits.nvim",
  build = "./kitty/install-kittens.bash",
  lazy = false,
}
````

The `lazy.nvim` plugin will notice the new config file the next time you start neovim and install the plugin for you. The `build` option adds a couple of python scripts to the `~/.config/kitty` directory that the plugin needs to work. The `lazy` option tells `lazy.nvim` to load the plugin immediately rather than waiting for you to call it. That last bit, `lazy = false` required a fair bit of time, and help from `dotfrag` on the [LazyVim discussion board](https://github.com/LazyVim/LazyVim/discussions/4088) to figure out.

Next, choose some keyboard shortcuts to move between windows. I'm using the recommended ones, `Ctrl+h`, `Ctrl+j`, `Ctrl+k`, and `Ctrl+l`. I am also setting `mode = { "n", "i", "v" }` to indicate that I want the shortcuts to work in insert and visual modes as well as normal mode.

````lua
```lua
return {
  "mrjones2014/smart-splits.nvim",
  keys = {
    {
      "<C-h>",
      function() require("smart-splits").move_cursor_left() end,
      mode = { "i", "n", "v" },
      desc = "Move to left window",
    },
  -- ... similar for the other directions
````

At this point, you should be able to move your cursor between vim panes, but not yet between vim and terminal splits.

## Step 2: Update kitty config

Add the equivalent shortcuts to your kitty config:

```
map ctrl+j neighboring_window down
map ctrl+k neighboring_window up
map ctrl+h neighboring_window left
map ctrl+l neighboring_window right

# Unset the mapping to pass the keys to neovim
map --when-focus-on var:IS_NVIM ctrl+j
map --when-focus-on var:IS_NVIM ctrl+k
map --when-focus-on var:IS_NVIM ctrl+h
map --when-focus-on var:IS_NVIM ctrl+l
```

When a neovim window is focused, we want to let the `Ctrl+j` etc keypresses pass through to neovim. That's what the second block of `map` directives does.

At this point, you should be able to move between terminal splits and _into_ neovim splits, but you probably can't move from a neovim split back to a terminal split. That's because we haven't told `kitty` to allow remote commands yet. Add the following to your `kitty.conf`:

```
allow_remote_control yes
listen_on unix:/tmp/mykitty
```

Restart kitty again and see if it works. I actually found that it didn't initially (but it does now that I'm writing it 🤷🏻). If it also doesn't work for you, you can try adding command line flags to allow remote control. Create a file at `~/.config/kitty/macos-launch-services-cmdline` and add the following:

```
-o allow_remote_control=yes --single-instance --listen-on unix:/tmp/mykitty
```

That did the trick for me.

Thanks again to `dotfrag` for helping me troubleshoot the smart-splits plugin. If you visit that discussion board page, you'll see a lot of back and forth and I really appreciate all the time they spent with me.
