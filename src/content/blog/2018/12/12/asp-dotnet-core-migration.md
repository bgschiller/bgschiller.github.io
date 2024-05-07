---
title: Migrating an ASP Web App to .NET Core
category: blog
tags: [programming, dotnet, csharp]
date: 2018-12-12
description: Migrating a small ASP.NET web api from .NET Framework 4.6 to .NET Core.
---

I recently had the opportunity to migrate a small ASP.NET web api from .NET Framework 4.6 to .NET Core. There were a few gotchas along the way, so it seems worth writing up what I found.

## Motivation

We originally used .NET Framework to be compatible with the client's existing codebase, even though this was a project without any dependencies on the existing services. Why bother transitioning at all? There are some elements of a modern web development system that we found lacking with .Net Framework:

- Take config from the environment
- Run integration tests on the CI server
- Deploy on linux servers
- Use the editors of our choice, and compile with command line tools
- To be frank, we wanted to use our preferred operating systems (mac and linux, respectively)

## Gotchas

### Entity Framework is anemic

Entity Framework Core is much less powerful than Entity Framework 6. It's missing support for implicit many-to-many relationships, and has no support for ad-hoc queries.

#### Replacing many-to-many tables

One of the developers of EF Core, Arthur Vickers, has a [4-part blog series](https://blog.oneunicorn.com/2017/09/25/many-to-many-relationships-in-ef-core-2-0-part-1-the-basics/) that concludes with exposing what looks like the same API for many-to-many as EF 6. There are a couple of github issues and stack overflow questions referring to this blog post. I'm not sure why it hasn't just been included in the library and "blessed" as the correct way to do things. The only downside is that you're still required to name and map the join tables, but I'd consider that worth doing anyway. It often makes possible more efficient queries.

#### Ad-hoc queries

I didn't find anything that suited the way I wanted to do ad-hoc queries, but was able to combine a couple of suggestions into something workable. There's an issue tracking this at [aspnet/EntityFrameworkCore#10365](https://github.com/aspnet/EntityFrameworkCore/issues/10365).

First, we need a way to issue SQL queries. Luckily, the EF context gives us access to the underlying db connection. A comment in that GitHub issue directs us toward the following:

```csharp
using (var command = context.Database.GetDbConnection().CreateCommand())
{
    command.CommandText = "SELECT MyIntegerColumn FROM MyTable";
    DbDataReader reader = command.ExecuteReader();

    while (reader.Read())
    {
        // do something with each in the list or just return the list
    }
}
```

Next, we need a way to transform each row os the `DbDataReader` into a type of our choosing. This is accomplished by way of a Mapper class that I found on Stack Overflow: https://codereview.stackexchange.com/a/98736

The final code ends up pretty nice. After getting permission from the client to open-source it, it's been merged into [devel0/netcore-ef-util](https://github.com/devel0/netcore-ef-util)

### Authorization Framework is... worse

The authorization system is also way less powerful. it used to give access to the route, which let us make resource-based decisions. For example, you could check that the logged-in user was the creator of a resource.

```csharp
// inside a System.Web.Http.AuthorizeAttribute...
public override bool IsAuthorized(AuthorizationFilterContext actionContext, EligibilityPrincipal principal)
{
    var postId = ControllerParams.Read(actionContext, "postId")
    return (
        principal.HasClaim(ADMIN) ||
        principal.HasClaim(AUTHOR_OF_POST, postId) ||
        PostService.IsPublished(postId)
    );
}
```

Then, our controller gets an AuthorizationAttribute:

```csharp
[Route("api/posts/{postId}"), HttpGet]
[AuthorOfPost]
public ObjectResult ViewPost(PostId postId)
{
    // Auth check has already been done,
    // just retrieve and return the post.
}
```

This pattern allowed us to separate resource-based authorization checks from the controller and the code that actually interacted with resource. Here's what the ASP.NET Core docs have to say about [Resource-based Authorization](https://docs.microsoft.com/en-us/aspnet/core/security/authorization/resourcebased?view=aspnetcore-2.1&tabs=aspnetcore2x)

> Attribute evaluation occurs before data binding and before execution of the page handler or action which loads the document. For these reasons, declarative authorization with an `[Authorize]` attribute won't suffice. Instead, you can invoke a custom authorization method—a style known as imperative authorization.

"Imperative authorization", if you read further in the document, is just putting explicit auth checks into the controller body. The way they're recommending is to add all your "policies" to their "AuthorizationService" so that you can call their authorization service from the controller to decide whether to proceed or to send a 403.

At that point, I'm annotating my controllers with "Policies" that I've registered with the "AuthorizationService" so I can call the AuthorizationService from my controller and it will tell me if the user is allowed to access the resource. What a lot of indirection! Why am I telling the framework about my policies, then asking it to tell me about them in the controller? I can just run some code. Here's what I've done instead.

```csharp
public class BlogAuthorization
{
    public static bool MayEditPost(ClaimsPrincipal principal, PostId postId)
    {
        // check if they're the author of the post, or an admin.
    }
    public static bool MayViewPost(ClaimsPrincipal principal, PostId postId)
    {
        // check if post is published (vs draft)
        // or if user is the author or an admin.
    }
    // ...
}
```

And then, in the controller, I can say

```csharp
[Route("api/posts/{postId}"), HttpGet]
public ObjectResult ViewPost(PostId postId)
{
    if (!BlogAuthorization.MayViewPost(HttpContext.User, postId))
    {
        return StatusCode(403, new { error = "You don't have permission to view this post." });
    }
    // ...retrieve and return the post.
}
```

It's not _great_, but it's certainly no worse than

```csharp
[Route("api/posts/{postId}"), HttpGet]
public ObjectResult ViewPost(PostId postId)
{
    var authorizationResult = _authorizationService.Authorize(HttpContext.User, postId, "ViewPolicy")
    if (!authorizationResult.Succeeded)
    {
        return StatusCode(403, new { error = "You don't have permission to view this post." });
    }
    // ...
```

This is a case where I don't see a reason for hooking your code into the framework. There's no benefit to it, and the code is far easier to understand if it's just calling an object under your control.

## Conclusion

Aside from these couple of hiccups, things went pretty smoothly. There were a number of other small changes to the public ASP.NET api. I can imagine that in a larger app it would have taken longer, but I was able to do this migration in an afternoon.
