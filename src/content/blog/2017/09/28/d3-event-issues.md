---
title: d3 Event Issues
category: blog
tags: [programming, web, d3, javascript]
date: 2017-09-28
description: A detective story tracking down why d3.event was null in a throttled function.
---

_Cross-posted from [github.com/bgschiller/d3-event-issue](https://github.com/bgschiller/d3-event-issue)_

Our story begins with some code that boils down to this:

```javascript
const grid = document.querySelector("#grid svg");
const highlightCoordinates = function () {
  const coords = d3.mouse(grid);
  // do something with those coordinates.
};
grid.addEventListener("mousemove", highlightCoordinates);
```

The issues appeared when we decided to throttle that function (using lodash, but underscore would likely be the same):

```javascript
grid.addEventListener("mousemove", _.throttle(highlightCoordinates, 100));
```

Lodash's throttle has `trailing` true by default (and we wanted to keep it on). The trailing call to `highlightCoordinates`, by definition, occurs _after_ all of the mousemove events are done. Using `d3.mouse()` meant that we were depending on the value of `d3.event`, and it had already been cleaned up at that point.

![A javascript traceback showing "Uncaught TypeError: Cannot read property 'sourceEvent' of null"](./cant_read_sourceEvent.png)

Following the advice on [this stack overflow post](https://stackoverflow.com/a/43424214/1586229), I set about modifying [lodash.throttle](https://github.com/lodash/lodash/blob/4.17.4/lodash.js#L10911) to capture the value of `d3.event`, and then put it back in place before invoking the function. Here's the interesting part of the code (or check out the [whole thing](https://github.com/NREL/openstudio-geometry-editor/blob/0790f88dd04123320278a6a1f22443690d587d29/src/utilities/d3-aware-throttle.js) if you like):

```javascript
function debounced() {
  var time = _.now(),
    isInvoking = shouldInvoke(time);

  lastArgs = arguments;
  lastThis = this;
  lastCallTime = time;
  // same as we're saving off the arguments and the context,
  // store the d3 event at the time of call.
  lastD3Event = d3.event;

  //... and now the actual work of checking if
  // we should invoke the function or do stuff with
  // the timer, etc....
}

function invokeFunc(time) {
  var args = lastArgs,
    thisArg = lastThis;

  // save the current value of d3.event, to put back after
  // we're done faking the value.
  var saveD3Event = d3.event;

  // put the d3 event at time of last call in place
  d3.event = lastD3Event;
  lastD3Event = lastArgs = lastThis = undefined;
  lastInvokeTime = time;
  result = func.apply(thisArg, args);

  // put back whatever was there before we messed with the value.
  d3.event = saveD3Event;
  return result;
}
```

New code, new error. Now, running this code gave the following error message:

![A JS traceback showing "Uncaught TypeError: Cannot set property event of #<Object> which only has a getter"](./only_has_getter.png)

It seems that `d3.event` can only be read from, not written to. I wasn't able to find where that is set up in d3's code, but I did find [this test](https://github.com/d3/d3/blob/17fbf8d4b16ed19303d71dee4881d871bddbc037/test/d3-test.js#L11-L20), which suggested that I could write to `d3Selection.event`, and it would change the value of `d3.event`. Inspecting the property in node confirmed that:

```
$ node
> const d3 = require('d3')
undefined
> Object.getOwnPropertyDescriptor(d3, 'event').get.toString()
'function () { return d3Selection.event; }'
```

Okay! Now we're getting somewhere! I changed my throttle code to set `d3Selection.event` instead, and this... worked! But, it seems, not on every machine. My teammate, Katie, was seeing the same error as before:

```
Uncaught TypeError: Cannot read property 'sourceEvent' of null
```

Debugging on her machine showed that _somehow_, setting d3Selection.event wasn't impacting the value of `d3.event`:

![The JS console shows that `d3Selection.event` was set to a MouseEvent, but d3.event is still null](./d3Selection_no_impact.png)

## ~The story continues~ (solved it. see below)

~I haven't solved this yet. I don't know why it works on my machine but not Katie's.~ I put together this repo to make it easier to investigate. Check out

- [setting d3.event directly](https://brianschiller.com/d3-event-issue/dist/setD3Event.html) (and the [source](https://github.com/bgschiller/d3-event-issue/tree/master/src/index.js))
- [setting d3Selection.event](https://brianschiller.com/d3-event-issue/dist/setD3SelectionEvent.html) (and the [source](https://github.com/bgschiller/d3-event-issue/tree/master/src/selectionIndex.js))
- [setting d3.event directly, but without bundling d3 with webpack](https://brianschiller.com/d3-event-issue/dist/cdn-d3.html)

## Got an idea?

You can run [this code](https://github.com/bgschiller/d3-event-issue) locally

1. `npm install` # install webpack, babel, d3, etc
2. `npm run build` # produces the files in dist.

## Another clue!

Oh! I almost forgot. Potentially another clue is that Katie's machine doesn't seem to be loading `d3-selection-multi` correctly (or I set it up correctly). I'm loading it via

```javascript
import "d3-selection-multi";
```

but she gets the following error:

```
Uncaught TypeError: measure.select(...).attr(...).attr(...).attr(...).attrs is not a function
```

## Potentially Relevant Links

- [https://github.com/d3/d3/issues/2733#issuecomment-271321156]()

## A Solution! but not a satisfying one...

Deleting the `node_modules/` directory, and doing a fresh `npm install` fixed things. My guess is that when I did `require('d3-selection')`, my coworker's machine was grabbing a different version than the `require('d3')` version was using internally.

Maybe `'d3-selection'` was once listed in package.json as a direct dependency, rather than a transitive dependency from d3? So when we set `d3Selection.event = ...`, it was assigning to a totally different copy of `d3Selection` than `d3.event` was reading from.
