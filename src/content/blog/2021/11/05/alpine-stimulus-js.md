---
title: Alpine.js vs Stimulus
date: 2021-11-05
description: A comparison of Alpine.js and Stimulus.js for adding interactivity to server-rendered pages (Alpine.js wins IMO).
category: blog
tags: [javascript, alpinejs, stimulus]
---

My team is experimenting with doing server-rendering more of our Rails web app. The time to download and parse React, Redux, React-I18N, plus a bunch of components is making page loads unacceptably slow for users. Server-rendering leaves a gap though—how to attach interactive behavior, like accordions, toggle menus, filtering, etc? The stuff we used to use jQuery for, before React showed us a better way.

Initially, we planned to use Stimulus.js to cover this gap. It has a large community (relatively speaking—still nothing compared with React, Vue, etc). Pretty good docs. Supported by the Rails folks at Basecamp. We set out using it, but found a couple of tasks to be so difficult and awkward as to cause us to re-evaluate. It's definitely an improvement over jQuery, but there's still a lot of manual DOM manipulation that I could do without.

In its place, we picked up Alpine.js. I'm familiar with Vue from other projects, so the mental model felt comfortable (Alpine uses `@vue/reactivity` under the hood). I was immediately _much_ more productive. Writing Stimulus controllers felt like a puzzle sometimes—how can I make this controller appropriately reusable? With Alpine, you might sometimes extract a reusable component, but often you'll write everything inline and still have fewer magic attributes in your html markup than if you'd used Stimulus.

Initially, I didn't understand that Alpine `x-data` scopes could be nested. This seemed like a huge drawback, so I avoided it. A closer reading of the docs (and trying it out) proved me wrong.

> Properties defined in an x-data directive are available to all element children. Even ones inside other, nested x-data components.

I've put together a couple tasks and example solutions in both Stimulus and Alpine. I was excited to use Stimulus at the beginning, so this shouldn't be a strawman argument—I really did my best with both options. If you have recommendations on how either could be improved, please send me an email. I'm still very new to both frameworks, and would welcome your suggestions and feedback.

A heads up: If you're not familiar with them, you may want to skim the docs for library before reading this post.

## What about petite-vue

This article was originally written using petite-vue in place of Alpine. I ended up deciding to use Alpine because of the larger community and because petite-vue is expressly not a priority for the Vue team right now (from the README: "The issue list is intentionally disabled because I have higher priority things to focus on for now and don't want to be distracted").

However, the same things that are great about Alpine are also great about petite-vue. In these small examples you can replace `x-*` with `v-*` and have everything work exactly the same, modulo some slightly different setup with the analytics function.

## Task 1: Filterable

Filter some content based on a search query provided as an input. Some requirements:

- The user types their query, but results are not filtered until they press "enter" or click a button. Clicking the button also triggers an analytics event.
- Each item is expandable/collapsible. This gets at the "can scopes be nested?" question that, at first, I wasn't sure Alpine could handle.
- Upon expanding/collapsing, the aria-expanded and aria-hidden flags should be toggled appropriately.
- Each expand/collapse triggers another analytics event.

### Stimulus

_See the full working example at [https://codepen.io/bgschiller/pen/YzxQoPj](https://codepen.io/bgschiller/pen/YzxQoPj)_

This should have been right in the sweet spot for Stimulus, which pushes reusable controllers. Filtering and toggling are both very reusable behaviors. Triggering an analytics event is exactly the sort of orthogonal concern that we should be able to move into a separate controller. Unfortunately, I ended up needing to mix the analytics code into both the Filter and Toggle controllers. Not the worst thing ever.

Let's start with the filter part. In order to make my FilterController reusable, I didn't want to hard-code that it's always filtering on `$el.innerText`. That meant I needed to add a `data-filter-key` to each element, which bloats the size of my html.

```html
<li
  data-filter-target="filterable"
  data-filter-key="golden retriever golden retrievers rule, but they shed everywhere"
></li>
```

Using of Stimulus targets works great for this. I was glad that the JS code doesn't need to know which elements to show and hide—it just grabs `this.filterableTargets`. I didn't understand at first why I have to set those as a static list, but it seems like it's to allow for `this.{some-target-name}Targets` to automagically run something like `this.$el.querySelectorAll('[data-filter-target="{some-target-name}"]')`. If we didn't specify the targets, it would be hard for Stimulus to make the proper getters.

```js
class FilterController extends Stimulus.Controller {
  static classes = ["notFound"];
  static targets = ["source", "filterable"];

  search(event) {
    event.preventDefault();
    const query = this.sourceTarget.value.toLowerCase();
    this.filterableTargets.forEach((el) => {
      const key = el.getAttribute("data-filter-key");
      el.classList.toggle(this.notFoundClass, !key.includes(query));
    });
  }
  // ...
}
```

Passing the class name into the FilterController felt a bit more awkward. The attribute, `data-filter-not-found-class="filter--not-found"`, is super long. The name transformation from `static classes = ["notFound"]` to the kebab case `data-filter-not-found-class` took me a bit to figure out. Works fine inside the `search` method though.

```html
<form
  class="dog-breeds"
  data-controller="filter"
  data-action="filter#search"
  data-filter-not-found-class="filter--not-found"
></form>
```

For the ToggleController, I tried hard-coding the class, `expanded` to see if that felt better. Definitely briefer, but now the implicit interface of the controller is bigger. That is, I have to add comments explaining what class is toggled.

```js
// ...
toggle(event) {
  const expandedPresent = this.element.classList.contains("expanded");
  this.element.classList.toggle("expanded", !expandedPresent);
  // ...
```

Finally, there is the worst bit of all: toggling the aria-expanded attribute. We don't assume that any element with an aria-expanded attribute should be toggled by our class; maybe it's associated with some other behavior. So we need some way to signal "Hey, _this_ attribute should be toggled along with the class". Best I could come up with was `data-toggle-target="ariaExpander"` and the following js code:

```js
// ...
this.ariaExpanderTargets.forEach((el) => {
  el.setAttribute("aria-expanded", expandedPresent);
});
// ...
```

This doesn't come up in the example, but what would happen if you tried to put a toggle-able element inside another toggle-able element? I didn't see a way to name the instances of each controller, like "outer" and "inner". When I tried it, it seemed to work but the aria-expanded attributes got out of sync. Didn't dig into it too far though, so that could have been a bug in my code.

### Alpine.js

_See the full working example at [https://codepen.io/bgschiller/pen/LYjdEzj](https://codepen.io/bgschiller/pen/LYjdEzj)_

This felt way more comfortable to me. I like having a JS value as my data model, and deriving DOM changes from that.

Starting with the filter bit, there is a bit of awkwardness in having both `query` and `stagedQuery` values. It's necessary because `x-model` will cause `stagedQuery` to change at every keypress, but we don't want to trim down our list of dogs until the user hits enter or "search". Not too bad, but it is something we didn't need over in Stimulus-land.

```html
<form
  x-data="{ query: '', stagedQuery: '' }"
  @submit.prevent="query = stagedQuery"
  x-effect="analyticsNotify({ event: 'search', text: query, section })"
>
  <input x-model="stagedQuery" />
  <input type="submit" value="Search" />
  <button @click="query = stagedQuery = ''">Clear</button>
</form>
```

I'm particularly happy with the `x-effect` usage. `x-effect` invokes the expression whenever any of the variables in the expression change. In this case, `query` is the only one that could change, but it could change due to a click on either of the buttons, or from the user pressing "enter". The `x-effect` lets us avoid attaching analytics code to each source of the change, and instead associate them with the data changing.

I called out in the Stimulus example that it felt presumptive to hard-code the query to always be looking in `$el.innerText`, yet I went ahead and did just that here. Why the difference? There's no attempt to re-use this chunk of behavior for other parts of the app. We can safely define it exactly how we need it, and make whatever assumptions are right for _this_ part of the app.

```html
<li x-show="!query || $el.innerText.toLowerCase().includes(query)"></li>
```

The toggle behavior is also simple. We define an `open` variable attached to each `<li>` tag and the `aria-expanded` and `x-show`, and `x-text` attributes watch that for changes. One thing to note: `aria-expanded` is not the same as the `x-bind` shorthand, `:aria-expanded`. So we aren't setting that attribute for clients who have JS turned off. In a real app you might want to set both in order to support screen-reader users with JS turned off.

```html
<li
  x-show="!query || $el.innerText.toLowerCase().includes(query)"
  x-data="{ open: false }"
  x-effect="analyticsNotifyToggle(open)"
>
  Poodle
  <button @click="open = !open" x-text="open ? '▲' : '▼'"></button>
  <p :aria-expanded="open" x-show="open" x-cloak>
    Poodles are wicked smaht but sometimes assholes.
  </p>
</li>
```

In the snippet above, you can see that we applied the same `x-effect` trick from before: synchronize an analytics event with the data changing. `x-effect` runs once when the app attaches to the DOM though, and we don't want that function to fire for every `<li>` when the page first loads.

The best way I could find to solve this was to change my `analyticsNotify` function to ignore all invocations for the first 20ms that JS was active on the page.

```js
let ignoreAnalytics = true;
setTimeout(() => {
  ignoreAnalytics = false;
}, 20);
function analyticsNotify(event) {
  if (ignoreAnalytics) return;
  console.log("analytics push", event);
}
```

The Alpine example doesn't need nearly as much css support as Stimulus. `x-show` is doing a lot for us, so we don't have to set a class and hope the css is consistent with our goals. Fewer files to edit to accomplish the same behavior, and you don't have to go read the css rules to find out what a given class does.

The only css we need for this demo is to set up `x-cloak`. `x-cloak` is a funny attribute that does almost nothing: when Alpine wakes up and attaches to the page, it removes it. Without it, there is a moment when Alpine hasn't yet taken control so we can still see everything that would be hidden by an `x-show` or styled differently with `v-bind:class`. `x-cloak` covers us for that period of time.

```css
[x-cloak] {
  display: none;
}
```

## Task 2: Toggle Menu

Open/close a menu on click.

- The menu should also be closeable if the user presses the escape key. (Can we respond selectively to keypress events)
- The menu should be closeable if we click outside of it.
- opening/closing the menu should trigger an analytics event.

### Stimulus

_see the full working example at [https://codepen.io/bgschiller/pen/jOLLNpj](https://codepen.io/bgschiller/pen/jOLLNpj)_

This one went some better for stimulus. The markup is cleaner, and we were able to re-use the toggle controller from the other page. That seems to be one of Stimulus' main goals. We still have the ugly `data-toggle-target="ariaExpander"`. Also, we needed to add an overlay div purely to capture click events outside of the menu.

```html
<div class="menu" data-controller="toggle">
  <button
    data-action="toggle#toggle keydown->toggle#closeOnEscape"
    data-analytics-section-param="nav menu"
  >
    Menu
  </button>
  <div class="overlay" data-action="click->toggle#toggle"></div>
  <ul class="navlist" aria-expanded="false" data-toggle-target="ariaExpander">
    <li>home</li>
    <li>posts</li>
    <li>pages</li>
  </ul>
</div>
```

We needed extra JS to accomplish "close the menu on keypress, but only if the keypress is Escape". It's also awkward how we have to check the state by looking at the classlist. Maybe there's another way I should be doing that?

```js
class ToggleController extends Stimulus.Controller {
  // ...
  closeOnEscape(event) {
    if (event.key === "Escape") {
      if (this.element.classList.contains("expanded")) {
        this.toggle(event);
      }
    }
  }
```

Also, this one has a bug. When the menu is open, it can be closed by clicking elsewhere on the page, but not to the right of the navlist. That's probably something I could fix with css, but I'm still counting it against Stimulus because Alpine has a `.outside` click modifier built-in.

### Alpine.js

_see the full working example at [https://codepen.io/bgschiller/pen/WNEzvLj](https://codepen.io/bgschiller/pen/WNEzvLj)_

No complaints, worked like a charm. I particularly love the `.outside` modifier, which let us skip the overlay div that was needed for Stimulus and all the supporting CSS. How'd they fit all this good stuff into 7kb?

```html
<div class="menu"
  x-data="{ open: false }"
  x-effect="$notify({
    event: 'collapse',
    section: 'nav menu',
    action: open ? 'expanded' : 'collapsed'
  })"
>
  <button @click="open = !open" @keydown.escape="open = false">Menu</button>
  <ul class="navlist" x-show="open" @click.outside="open = false" x-cloak>
    <li>home</li>
    <li>posts</li>
    <li>pages</li>
  <ul>
</div>
```

## Conclusion

I can enthusiastically choose Alpine over Stimulus. Stimulus seems to have skipped the lessons of the past 7-8 years. It's better than jQuery, but ignores the things that are good about React, Vue, etc: reactivity and declarative rendering. Meanwhile, Alpine manages to pack a ton of useful functionality into a _smaller_ bundle size than Stimulus.
