import type { Alpine } from "alpinejs";

export default (Alpine: Alpine) => {
  // Access this data by using `x-data="astro" x-bind="refreshOnPageLoad"`.
  Alpine.data("astro", () => ({
    // re-evaluate expressions when the page loads by including `pageLoaded` in the expression
    // eg, `x-if="pageLoaded && typeof myComponent !== 'undefined'"`
    pageLoaded: 1, // The value here isn't important, just that it is truthy and changes with each page load
    refreshOnPageLoad: {
      ["@astro:page-load.document"]() {
        this.pageLoaded++;
      },
    },
  }));
  return Alpine;
};
