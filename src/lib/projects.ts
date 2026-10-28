export interface ProjectTag {
  title: string;
  url: string | null;
}

export interface Project {
  title: string;
  slug: string;
  description: string;
  link: string | null;
  tags: ProjectTag[];
  awards: number;
  /** aspect ratio width/height of the carousel card */
  aspect: number;
  /** media for the project sheet, first item is the carousel texture */
  media: string[];
}

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Empty until new curated starter templates are ready to publish. */
export const FEATURED: Project[] = [];

/** Curated website templates available in the website-template browser. */
export const WEBSITE_TEMPLATES: Project[] = [
  {
    title: "Rose",
    slug: "rose",
    description: "A romantic rose website with the original design, a personal editable message, and an interactive rose.",
    link: null,
    tags: [],
    awards: 0,
    aspect: 1,
    media: [`${BASE_PATH}/website-templates/rose-preview.svg`],
  },
  {
    title: "A Little Red Letter",
    slug: "red-letter",
    description: "A dimensional red envelope opens to the same personal letter, which expands into a 2:3 full-screen sheet.",
    link: null,
    tags: [],
    awards: 0,
    aspect: 1,
    media: [`${BASE_PATH}/website-templates/red-letter-preview.svg`],
  },
  {
    title: "Love Heart",
    slug: "love-heart",
    description: "A glowing heart formed from “I love you” in 20 languages, with a slow reveal and soft recurring shimmer.",
    link: null,
    tags: [],
    awards: 0,
    aspect: 1,
    media: [`${BASE_PATH}/website-templates/love-heart-preview.png`],
  },
  {
    title: "I love you forever and ever, my baby!",
    slug: "forever-and-ever",
    description: "A blank, editable notebook-style love letter with three personal photo slots and a soft blue paper theme.",
    link: null,
    tags: [],
    awards: 0,
    aspect: 1,
    media: [`${BASE_PATH}/website-templates/forever-and-ever-preview.png`],
  },
  {
    title: "Our Calendar",
    slug: "our-calendar",
    description: "A scrapbook-style open-book calendar with editable memory notes, five personal photo slots, and a movable heart date marker.",
    link: null,
    tags: [],
    awards: 0,
    aspect: 1,
    media: [`${BASE_PATH}/website-templates/our-calendar-preview.png`],
  },

  {
    title: "who’s birthday is it today?",
    slug: "birthday-today",
    description: "A soft-blue birthday page with an editable name pill and four personal photo slots.",
    link: null,
    tags: [],
    awards: 0,
    aspect: 1,
    media: [`${BASE_PATH}/website-templates/birthday-today-preview.png`],
  },
  {
    title: "Introducing Him",
    slug: "introducing-him",
    description: "A social-post-inspired romantic page with a personal photo and a continuously scrolling love poem.",
    link: null,
    tags: [],
    awards: 0,
    aspect: 1,
    media: [`${BASE_PATH}/website-templates/introducing-him-preview.png`],
  },
];

export interface IndexItem {
  title: string;
  href: string;
  external: boolean;
}

export const FULL_INDEX: IndexItem[] = FEATURED.map((project) => ({
  title: project.title,
  href: `${BASE_PATH}/projects/${project.slug}`,
  external: false,
}));

export const SITE = {
  name: "Paper Stish",
  role: "personal website maker",
  summary:
    "Create a personal design for someone special, then publish it as a shareable website with Paper Stish.",
  about:
    "Start with an idea, make the design yours, and send one simple link. Published websites open in a browser without requiring visitors to sign in.",
  awards: "Create something personal. Make it yours. Share it with a link.",
  email: "sandeepdolai.info@gmail.com",
  profiles: [] as { title: string; url: string }[],
};
