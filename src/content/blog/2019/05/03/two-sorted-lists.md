---
title: "A Tale of Two Sorted Lists: Comparing Inheritance and Composition"
category: blog
tags: [programming, design-patterns, python, oop]
date: 2019-05-03
description: "We'll explore two different approaches to solving the same problem: Inheritance and Composition. At first glance, the Inheritance example looks more correct and is a bit shorter. I want to convince you that the Composition approach is more correct."
---

As advice goes, "Favor Composition over Inheritance" is pithy and uncontroversial. Unfortunately, it also doesn't make much sense unless you already know what it means. We'll explore two different approaches to solving the same problem: Inheritance and Composition. At first glance, the Inheritance example looks more correct and is a bit shorter. I want to convince you that the Composition approach is more correct.

### What's Composition? What's Inheritance?

It's easier to understand by looking at an example, but it is useful to have some idea of what you're watching for. Composition and Inheritance are both techniques to lean on existing code instead of duplicating logic. We'll see how this looks in code in a minute, but as a shorthand, you can say that

- Inheritance is used to model an "Is-a" relationship, eg: "A `PoissonRandomNumberGenerator` is-a (specific case of) a `RandomNumberGenerator`"
- Composition is used to model a "Has-a" relationship, eg: "A `PoissonRandomNumberGenerator` has-a (makes use of) a `RandomNumberGenerator`"

Either choice is defensible for the random number example. However, the adage guides us towards Composition. You may not yet have an intuition for why this is, but we'll get there :)

### To build: a SortedList

We'd like to make a SortedList data structure. By keeping the elements in sorted order we can make the "does this list contain `x`?" operation _really fast_. Insert and delete operations will be a bit slower, but we are willing to pay that price for some use cases.

We'll use the Python standard library's `bisect` module to do most of the heavy lifting. The `bisect` function tells you what index to find an item, assuming the list is sorted. The `insort` function (a pun: "insert sorted") performs an insert to a sorted list in the right spot to keep it sorted. That's exactly what we need! This means we can focus almost entirely on the differences between our two approaches.

Here's how our sorted lists should behave:

```python
sl = SortedList()
for elem in (12, 4, 15, 2):
    sl.insert(elem)
print(4 in sl) # True
print(18 in sl) # False
print(', '.join(elem for elem in sl)) # 2, 4, 12, 15
```

You might say: "Why bother writing a `SortedList` class at all? Don't the `insort` and `bisect` functions together do what we need? They do the right actions, but we're kinda coding without guard rails if we use them without a wrapper class. Remember: those functions _assume_ the list is sorted to begin with—they don't check it! We would have to be diligent about _never_ accidentally breaking the sorted order in any code using a list we want to use `bisect` and `insort` on, or we could introduce very difficult bugs into our code. An example of how this could bite us:

```python
from bisect import bisect, insort
keep_me_sorted = []

insort(keep_me_sorted, 4)
insort(keep_me_sorted, 10)

# Danger! did the writers of include_fav_numbers know they have to
# keep the list in sorted order? Will they continue to remember in the future?
include_fav_numbers(keep_me_sorted)

# if they forgot, bisect and insort will no longer work properly on the list
```

Our fast search only works if the list is sorted, which is hard to guarantee with discipline alone. We could sort the list just before any time that we use `bisect` or `insort`. That would work, but it would erase all the performance benefits we're getting from using `bisect` in the first place! Instead, let's use _encapsulation_ to protect the list from modifications that would break our sorted order.

### Implementing the InheritanceSortedList

Using inheritance to make a `SortedList` seems like a natural choice. A `SortedList` is-a list! Done and done. Let's start there.

```python
from bisect import insort, bisect

class InheritanceSortedList(list):
    def insert(self, elem):
        insort(self, elem)

    def __contains__(self, elem):
        """
        __contains__ is the method that is called when
        code like `x in collection` runs. This is where
        we get our performance boost over a regular list.
        """
        # Find the index where elem *might* be found
        ix = bisect(self, elem)
        return ix != len(self) and self[ix] == elem
```

So... are we done? This seems to do what we want. This list will work for simple examples, but we'll see later that it doesn't provide the encapsulation we're looking for. First, let's look at the Composition option.

### Creating the CompositionSortedList

To use Composition, we'll make an object that includes a list as a hidden property.

```python
from bisect import insort, bisect

class CompositionSortedList:
    def __init__(self):
        self._lst = []

    def insert(self, elem):
        insort(self._lst, elem)

    def __contains__(self, elem):
        ix = bisect(self._lst, elem)
        return ix != len(self._lst) and self._lst[ix] == elem
```

Okay, a bit longer than the Inheritance example, but not too bad. Unfortunately, this one doesn't quite pass our test. Specifically, `(elem for elem in sl)` will fail with an error:

> TypeError: iteration over non-sequence

Similar to the `__contains__` magic method, objects can define how to loop over them using the `__iter__` method. When we made the `InheritanceSortedList`, we got a definition of `__iter__` by way of inheriting from `list`. With Composition, we'll have to define one:

```python
class CompositionSortedList:
    # ...
    def __iter__(self):
        return iter(self._lst)
```

Luckily, it's not too complicated. We basically say "To iterate over a `CompositionSortedList`, simply iterate over the hidden `_lst` bit". This is common enough that it has a special name. We can say that a `CompositionSortedList` _delegates_ to its `_lst` property. We'll see later how to make this even nicer.

### InheritanceSortedList breaks down

Whether we wanted to or not, `InheritanceSortedList` has inherited _all_ of `list`'s behavior—including things we don't want. For example, we have an `append` method:

```python
lst = InheritanceSortedList()

lst.append(4)
lst.append(5)
print(5 in lst)  # prints 'False'
```

We also have an `__init__` that we didn't bargain for:

```python
lst = InheritanceSortedList([5, 3, 2])
print(2 in lst)  # prints 'False'
```

The `__init__` and `append` methods came straight from the `list` parent class. They don't _know_ that they're supposed to be maintaining sorted order! They're doing the right thing for intializing or appending to a regular `list`, regardless of the fact that it's the wrong thing a `SortedList`.

We can fix these up without too much work:

```python
class InheritanceSortedList(list):
    def __init__(self, iterable=()):
        super().__init__(self)
        for elem in iterable:
            self.insert(elem)
    def append(self, elem):
        raise RuntimeError("Appending to a sorted list could break sorted-order. Use insert instead")
    def extend(self, iterable):
        raise RuntimeError("extending a sorted list could break sorted-order. Use insert instead")
    # ...are there others?
```

But this feels fragile to me. Have we caught and fixed all the methods that might break sorted order? Even if we have, could a future version of `list` add a new one? This is sometimes called the [Fragile base class problem](https://en.wikipedia.org/wiki/Fragile_base_class), where changes to the parent class (`list`) may unintentionally break a derived class (`InheritedSortedList`).

It also just feels messy to have a bunch of methods that do nothing but raise exceptions. I wish we could just skip defining those. Let's see how it might work with Composition.

### CompositionSortedList builds up

In a way, `CompositionSortedList` has the opposite problem. There's a bunch of functionality on the list that we _want_ to make available. Just like we did with `__iter__`, we can make methods that delegate to the private list property:

```python
class CompositionSortedList:
    # ...
    def __iter__(self):
        return self._lst.__iter__()
    def __len__(self):
        return self._lst.__len__()
    def __getitem__(self, ix):
        return self._lst.__getitem__(ix)
    def __reversed__(self):
        return self._lst.__reversed__()
```

In comparison to the Inheritance implementation where we had to opt-out of methods that would break our sorted order, we're opting-_in_ to behaviors that we want to make available. This protects us from the fragile base class problem!

It may be a personal preference of mine, but I feel that composition is also _clearer_. I don't have to dig through an inheritance hierarchy to figure out where a method was defined. Any functionality on a class using composition is _right there_ on the class' definition.

### Extra Credit: An even better delegate pattern

I started wondering if there was a more succinct way to write all those delegate methods. They're pretty repetitive, and it seemed like it should be possible to get rid of them. I wrote a library called [superdelegate](https://github.com/bgschiller/superdelegate) that makes it possible. Here's what it can look like with superdelegate

```python
from superdelegate import SuperDelegate, delegate_to

class CompositionSortedList(SuperDelegate):
    # ...
    __iter__ = __len__ = __getitem__ = __reversed__ = delegate_to('_lst')
```

Pretty nice, I think!

### When would you use inheritance?

Composition is safer, clearer, and (with some help from `superdelegate`) almost as terse. So when would you use inheritance at all? Inheritance is appropriate in a few cases I can think of (please email me if you have other recommendations).

- When you really want to accept _all_ behavior of parent class (even future changes we don't know about yet). I did this in [bgschiller/citrus](https://github.com/bgschiller/citrus) because I wanted the derived objects to be able to be treated as if they were the parent type in all situations.
- When it's the way a framework wants you to customize behavior. Django's Class-based Views are a good example of this.
- When there's some weird metaclass going on. Think SqlAlchemy's DeclarativeBase models, or WTForms classes.

### References

- [https://code.activestate.com/recipes/577197-sortedcollection/](https://code.activestate.com/recipes/577197-sortedcollection/)
- [https://docs.python.org/2/library/bisect.html](https://docs.python.org/2/library/bisect.html)
