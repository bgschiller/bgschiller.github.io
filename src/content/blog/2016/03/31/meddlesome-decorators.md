---
title: Meddlesome Decorators
category: blog
tags: [programming, python, decorators]
date: 2016-03-31
description: When your decorators want to meddle with the function's arguments, things can get tricky. Here's a pattern for writing decorators that need to access the function's arguments.
---

Most decorators don't make assumptions about the decorated function's signature.
This is why they're usually written with `*args, **kwargs`, like this:

```python
def timed(func):
    @wraps(func)
    def timed_version(*args, **kwargs):
        start = datetime.now()
        result = func(*args, **kwargs)
        print 'that took', datetime.now() - start
        return result
    return timed_version
```

Those can be used on any function, because the `*args, **kwargs` can match any pattern of
arguments. Sometimes though, the decorator needs access to one of the function's arguments. For example the following decorator guards a Django view to check for parameters:

```python
def requires_POST(*param_names):
    '''enforces that a view be called with specific post params'''
    def check_params(view_func):
        @wraps(view_func)
        def wrapper(*args, **kwargs):
            request = kwargs['request']  # assuming request is always passed as keyword argument
            for param in param_names:
                if param not in request.POST:
                    return ParamNotFoundResponse(param)
            return view_func(*args, **kwargs)
        return wrapper
    return check_params
```

This works okay, but we are depending on the fact that Django sends the `request` parameter as a keyword argument. We could make this more robust by doing something like `kwargs.get('request', args[0])`, but that has it's own problem. Specifically, we're assuming that `request` is the _first_ parameter. (That assumption wouldn't be true for a class-based-view, because the first parameter would be `self`.)

Also, we don't just write decorators for views. I recently wrote a decorator that needs access to an `org_id` variable passed to the decorated function. Sometimes it's passed directly, but sometimes it's wrapped inside the `session` dictionary and the session is what's passed. This sounds like a headache of searching `kwargs` or trying to assume the order parameters are passed in order to get our hands on the `org_id`. Just for the sake of completeness, here's what that might look like:

```python
def find_org_id(args, kwargs):
    if 'org_id' in kwargs:
        org_id = kwargs['org_id']
    elif 'session' in kwargs:
        org_id = kwargs['session']['org_id']
    else:
      # uhh, I dunno, I guess we start looking through
      # args, trying to find one that looks like a session?
      for arg in args:
        if isinstance(arg, django.contrib.sessions.backends.db.SessionStore):
            org_id = arg['org_id']
            break
      else:
          # welll, dang. Let's just assume the first that's a string is
          # the org_id I guess?
          for arg in args:
              if isinstance(arg, basestring):
                  org_id = args['org_id']
                  break
          else:
              # Crap. I don't even know.
              raise RuntimeError("It doesn't look like this function take an org_id or a session.")
```

Ugh. That's just terrible. I did warn you. Luckily, there's a better way.

`inspect.getcallargs(func, *args, **kwargs)` returns a dictionary telling you what variables would be bound if you called `func` with `*args, **kwargs`. This is _so much better_ than trying to guess or assume the order of parameters, or forcing the callers to use always use keyword arguments. We can say:

```python
def find_org_id(func, args, kwargs):
  callargs = inspect.getcallargs(func, *args, **kwargs)
  if 'org_id' in callargs:
      return callargs['org_id']
  elif 'session' in callargs:
      return callargs['session']['org_id']
  raise RuntimeError('{} not called with org_id or session'.format(func.__name__))
```

What's more, we can use another function in the `inspect` module to statically ensure that this function expects either `session` or `org_id`. By statically, I mean that we can check when the function being decorated is defined, at import-time, rather than when it's called:

```python
def the_decorator(func):
    argspec = inspect.getargspec(func)
    assert 'org_id' in argspec.args or 'session' in argspec.args, \
      "the_decorator can only decorate functions that are passed an org_id or a session."
    def decorated(*args, **kwargs):
        org_id = find_org_id(func, args, kwargs)
        # Do whatever you needed to do with the org id
        return func(*args, **kwargs)
    return decorated
```
