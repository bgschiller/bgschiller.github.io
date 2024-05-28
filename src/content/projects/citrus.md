---
date: Jun 2, 2018
title: "citrus"
repoURL: "https://github.com/bgschiller/citrus"
---

A more convenient interface for doing Binary Linear Programming with PuLP. This package uses Python operator overloading to allow you to write

```python
model.addConstraint(x & y == 1, "Both x and y must be true")
```

instead of

```python
x_and_y = pulp.LpVariable("x_and_y", cat=pulp.Binary)
model.addConstraint(x_and_y == 1, "Both x and y must be true")
model.addConstraint(x_and_y <= x, "supporting constraint 1")
model.addConstraint(x_and_y <= y, "supporting constraint 2")
```

And similar for `|`, `negate`, `implies`, `maximum` and `minimum`.
