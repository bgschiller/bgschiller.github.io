import type { Site, Metadata, Socials } from "@types";

export const SITE: Site = {
  NAME: "Brian Schiller",
  EMAIL: "bgschiller@gmail.com",
  NUM_POSTS_ON_HOMEPAGE: 3,
  NUM_WORKS_ON_HOMEPAGE: 1,
  NUM_PROJECTS_ON_HOMEPAGE: 3,
  NUM_TALKS_ON_HOMEPAGE: 3,
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION:
    "Projects, notes, and articles from my work as a Software Engineer.",
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION: "A collection of articles on topics I am passionate about.",
};

export const WORK: Metadata = {
  TITLE: "Work",
  DESCRIPTION: "Where I have worked and what I have done.",
};

export const PROJECTS: Metadata = {
  TITLE: "Projects",
  DESCRIPTION:
    "A collection of my projects, with links to repositories and demos.",
};

export const TALKS: Metadata = {
  TITLE: "Talks",
  DESCRIPTION: "Slides and recordings of talks I have given.",
};

export const SOCIALS: Socials = [
  {
    NAME: "github",
    HREF: "https://github.com/bgschiller",
  },
  {
    NAME: "linkedin",
    HREF: "https://www.linkedin.com/in/bgschiller",
  },
];
