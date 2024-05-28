---
date: Nov 27, 2018
title: "vue-await"
repoURL: "https://github.com/bgschiller/vue-await"
---

Render blocks based on the status of a Promise. Demo at [brianschiller.com/vue-await/](https://brianschiller.com/vue-await/).

```vue
<template>
  <Await :p="prom">
    <p>Waiting...</p>
    <p slot="then" slot-scope="[result]">Success: {{ result }}</p>
    <p slot="catch" slot-scope="[error]">Error: {{ error }}</p>
    <p slot="none">(promise is null)</p>
  </Await>
</template>

<script>
export default {
  data() {
    return {
      prom: fetch("http://thecatapi.com/api/images/get"),
    };
  },
};
</script>
```
