---
title: I was Promised Pizza
category: blog
date: 2020-01-01
description: A coworker had a question about combining the values from multiple javascript Promises. I've tried to cull the interesting Promise construction out of the original problem, and came up with an example about pizza.
tags: [programming, javascript, promises, typescript]
---

A while back, a coworker had a question about combining the values from multiple javascript Promises. I've tried to cull the interesting Promise construction out of the original problem, and came up with an example about pizza.

My goal here is to focus only on how the functions are combined, and how they work internally. To that end, I've defined just their signature (argument types and return types) without the body. Here are the TypeScript declarations, so we can check our code. If you're not familiar with TypeScript, don't worry! I've left comments explaining the first couple functions, so you can get used to the pattern.

```typescript
// gatherIngredients is a function that takes no arguments
// and returns a Promise resolving to { tomatoes, basil, flour, ...}
declare var gatherIngredients: () => Promise<{
  tomatoes: "tomatoes";
  basil: "basil";
  flour: "flour";
  yeast: "yeast";
  mozzarella: "mozzarella";
}>;
// makeSauce is a function that takes { tomatoes, basil } as
// its only argument and returns a Promise resolving to 'sauce'.
declare var makeSauce: (i: {
  tomatoes: "tomatoes";
  basil: "basil";
}) => Promise<"sauce">;
// makeDough is a function that takes { flour, yeast } as its
// only argument and returns a Promise resolving to 'dough'
declare var makeDough: (i: {
  flour: "flour";
  yeast: "yeast";
}) => Promise<"dough">;
declare var spreadDough: (d: "dough") => Promise<"spread-dough">;
declare var assemblePizza: (
  i: ["spread-dough", "sauce", "mozzarella"],
) => Promise<"raw-pizza">;
declare var bake: (p: "raw-pizza") => Promise<"pizza">;
declare var eat: (p: "pizza") => Promise<void>;
```

Given these definitions, write a function to eat a pizza. If you'd like, use the [TypeScript playground](https://www.typescriptlang.org/play/?ssl=6&ssc=1&pln=7&pc=1#code/CYUwxgNghgTiAEA3W8DmUAuALEMCSAdqnMAJYgEYDOAXPABQCU8AvAHzwAKMA9gLakqIADwBvAFDx4Gfph4ha8AOQy+chUoDck+ACMoVUhDpL9hiFp0AzCDwCuMEzfsxLUgJ4gDGE5+9v4Ph4AL2DYEAhoEyDQ8MioSwBfNm1QSHCkFDUAaxAAZSg7MBA6elI6UWlZGQUTVXUqLT0DIxMzIybE5nYuXgEhYSUqQuKlFPE06DhMmECoXIARe1QsUvL4SucHJ1sHJr8qH2UDjE7ujm5+QRElYGWsMdTwKYRkWaoABzgoYCW7FdKwBMd3+D3OvSuAyGXy8wAAtCCVo8Js8Mm94AYhHxdBAQJxSLE1nQANrQ77wxEPAA0ymGRRAShpShiYTg8SUAF1wZd+jcYFAAO5wj4EsJjFHpabo-S5UofEz8oUi2JKbl9a6DZVi8aTNEoLxHejy5RahJqyEiRA8UjAcZAA) to check your work as you go.

(this space left intentionally blank)

(also blank, to hide the solution until you're ready)

## Solutions

I posed the question to the #help-typescript channel on the [Denver Devs slack group](denverdevs.org), and folks came up with a variety of solutions!

Here's a good first stab at the problem.

```typescript
gatherIngredients().then((ingredients) => {
  const { tomatoes, basil, flour, yeast, mozzarella } = ingredients;
  return makeSauce({ tomatoes, basil }).then((sauce) => {
    return makeDough({ flour, yeast }).then((doughBall) => {
      return spreadDough(doughBall).then((readyDough) => {
        return assemblePizza([readyDough, sauce, mozzarella]).then(
          (rawPizza) => {
            return bake(rawPizza).then((pizza) => {
              return eat(pizza).then(() => {
                console.log("yum!");
              });
            });
          },
        );
      });
    });
  });
});
```

This solution is correct, and reasonably clear. It's not perfect, so it makes a good starting place. Let's start with what it gets right:

- The steps are in the same order we will read them. Nice!
- Values that are created early but used later (like `mozzarella`) are still available when they're needed. This happens because each nested function is a closure, holding references to the variables that were available at the time the function was defined.

Stylistically, I have a problem with the inexorable march to the right side of the screen. Weren't promises supposed to save us from that?? We also make a couple of functions that are identical to `bake` and `eat` (eg, `rawPizza => { return bake(rawPizza); }` is _exactly the same_ as `bake`). You could also quibble about arrow functions with implicit returns, but I kinda like the consistency ¯\\\_(ツ)\_/¯. Performance-wise, there are some optimizations we could make. `makeSauce` and `makeDough` could be happening simultaneously, as they don't rely on one another's return values. Can we improve on these lines?

```typescript
gatherIngredients()
  .then(({ tomatoes, basil, flour, yeast, mozzarella }) => {
    return Promise.all([
      makeDough({ flour, yeast }).then(spreadDough),
      makeSauce({ tomatoes, basil }),
      // not a promise, just needs to passed along for future work
      mozzarella,
    ] as const);
  })
  .then(assemblePizza)
  .then(bake)
  .then(eat);
```

This solution is also correct, and it's parallel whenever possible (we can be making and then spreading dough at the same time as the sauce is cooking). We've managed to avoid the copious indentation of the first solution, which is nice. However, the trick we've used to get there is confusing and requires a comment to explain what's going on.

> To explain briefly, `Promise.all` will "upgrade" any value passed into it into a promise. So when I pass in `mozzarella`, `Promise.all` says, "That's not a promise, but I can treat it like a promise resolving to that value". This allows me to hand `mozzarella` along to the next function without using a closure.

There's also a weird bit with `as const`. TypeScript's best guess at the type of that array is `Array<'spread-dough' | 'sauce' | 'mozzarella'>`. That is, "An array where each of the values is one of these three things". But we want TypeScript to interpret it as having type "A 3-length array, with first 'spread-dough', then 'sauce', then 'mozzarella'". We can use the `as const` directive to tell TypeScript to assume the tightest possible type for that value.

This is about the best you can do using only Promise syntax. It avoids ever-deepening indentation of the closure-based solution. But we can avoid the confusing bit about passing `mozzarella` into `Promise.all` if we're allowed to use `async/await` syntax.

```typescript
async function nom() {
  const { tomatoes, basil, flour, yeast, mozzarella } =
    await gatherIngredients();
  const sauce = await makeSauce({ tomatoes, basil });
  const doughBall = await makeDough({ flour, yeast });
  const flatDough = await spreadDough(doughBall);
  const unbakedPizza = await assemblePizza([flatDough, sauce, mozzarella]);
  const pizza = await bake(unbakedPizza);
  await eat(pizza);
}
```

Async/await makes some things clearer than promises, but other things have become more difficult or verbose. We've had to come up with variable names for `doughBall`, `flatDough`, etc. We've also lost a bit of concurrency: `makeSauce` and `makeDough` can no longer run at the same time. We can fix that last problem, but our code starts to look a bit funky...

```typescript
async function nom() {
  const { tomatoes, basil, flour, yeast, mozzarella } =
    await gatherIngredients();
  const sauceP = makeSauce({ tomatoes, basil });
  const doughBallP = makeDough({ flour, yeast });
  const flatDough = await spreadDough(await doughBallP);
  const unbakedPizza = await assemblePizza([
    flatDough,
    await sauce,
    mozzarella,
  ]);
  const pizza = await bake(unbakedPizza);
  await eat(pizza);
}
```

In order to get `makeSauce` and `makeDough` running at the same time, we have to call the functions without awaiting the promise they return. To try and keep track of which things are promises and which are values, I've added a `P` suffix to the end of the variables that hold Promises. We need to remember to `await` these before trying to use the value (TypeScript will help us on this front). The Promise-only solution is starting to look pretty nice in comparison! Can we get the best of both worlds?

```typescript
async function nom() {
  const { tomatoes, basil, flour, yeast, mozzarella } =
    await gatherIngredients();
  const [sauce, flatDough] = await Promise.all([
    makeSauce({ tomatoes, basil }),
    makeDough({ flour, yeast }).then(spreadDough),
  ] as const);
  return assemblePizza([flatDough, sauce, mozzarella]).then(bake).then(eat);
}
```

In my opinion, this is the cleanest possible solution to this problem. We achieve it by taking advantage of both Promise syntax and `await`, each where appropriate:

- We used `.then` for `spreadDough`, `bake`, and `eat` because the return of the prior function matches the arguments.
- `Promise.all` is the clearest way to wait on two Promises that we kicked off at the same time.
- `await` allows us to maintain access to the results of Promises without marching off to the right side of the screen.

## How to use this in your own code

Keep the dual nature of Promises in mind. If you're just getting the hang of things, you may want to write two solutions: one each using Promises and `async/await`. Compare them and decide which one is clearer. As you get more practice, you'll develop instincts for when to use each technique.
