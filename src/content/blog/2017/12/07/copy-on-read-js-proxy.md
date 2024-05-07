---
title: Copy on Read with ES6 Proxy
category: blog
tags: [programming, web, es6, javascript]
date: 2017-12-07
description: Using a Proxy object to enforce making a deep copy of default values on read.
---

In NREL's [FloorspaceJS](https://github.com/NREL/floorspace.js) app, we used to define default values in code and also in the json schema. This wasn't ideal, because the two sources could get out of sync. We decided to keep the values _only_ in the schema, and read them into the app to use them.

I wrote some code to walk through the schema and return any default values it finds.

```javascript
import schema from "schema/geometry_schema.json";

const readDefaults = (definition) => {
  if (_.has(definition, "default")) return definition.default;
  if (definition.type === "null") return null;
  if (definition.type === "array") return [];
  if (definition.type === "object") {
    return _.mapValues(definition.properties, readDefaults);
  }
  return null;
};

export const defaults = _.mapValues(schema.definitions, readDefaults);
```

Then we can use the defaults like this:

```javascript
export function Story(name) {
  return {
    ...defaults.Story,
    id: idFactory.generate(),
    name,
    color: generateColor("story"),
  };
}
```

If you're very clever, you might notice a problem with this approach. If a schema definition includes an array property, our factory function will put the _very same array_ in each Story it creates. Pushing to one story's `spaces` property will add a value to _every_ story. It even adds the new value to the array inside the default value, so it affects stories that haven't even been created yet.

The solution is that each time we use the default value, we should make sure that it is a fresh version. I wasn't a fan of requiring every use of the defaults object to include a `_.cloneDeep`. It seemed repetitive, and needing extra code at every call-site of a function is a code smell. Couldn't that extra code be part of the exported api?

Here's what I came up with using a Proxy object to enforce making a deep copy on read:

```javascript
const rawDefaults = _.mapValues(schema.definitions, readDefaults);
export const defaults = new Proxy(rawDefaults, {
  get(target, key) {
    return _.cloneDeep(target[key]);
  },
  set() {
    throw new Error("Please do not change the defaults.");
  },
});
```

Now code using the defaults object is _unable_ to mess with the original values.
