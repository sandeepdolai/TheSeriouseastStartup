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
const T = `${BASE_PATH}/templates/`;

/** Original Paper Stish examples shown in the immersive starter carousel. */
export const FEATURED: Project[] = [
  {
    title: "Love of My Life",
    slug: "love-of-my-life",
    description: "A personal page for your favorite person, filled with memories, photos, and the words you want them to keep.",
    link: null,
    tags: [{ title: "Personal website", url: null }, { title: "Love", url: null }],
    awards: 0,
    aspect: 1200 / 1600,
    media: [T + "love-of-my-life.webp", T + "love-of-my-life-art.webp", T + "love-bow.webp"],
  },
  {
    title: "Favorite Person",
    slug: "favorite-person",
    description: "A little corner of the internet for the person who makes ordinary days feel special.",
    link: null,
    tags: [{ title: "Personal website", url: null }, { title: "For someone", url: null }],
    awards: 0,
    aspect: 1200 / 1600,
    media: [T + "love-favorite-person-art.webp", T + "love-cats.webp", T + "love-polaroid-frame.webp"],
  },
  {
    title: "Little Memories",
    slug: "little-memories",
    description: "Bring photos, notes, and tiny moments together in one page you can share with a link.",
    link: null,
    tags: [{ title: "Memories", url: null }, { title: "Personal website", url: null }],
    awards: 0,
    aspect: 4 / 5,
    media: [T + "love-polaroid-frame.webp", T + "love-paper-texture.webp", T + "love-bow.webp"],
  },
  {
    title: "A Love Note",
    slug: "a-love-note",
    description: "Turn the message you keep rewriting into a thoughtful, shareable little website.",
    link: null,
    tags: [{ title: "Love note", url: null }, { title: "Personal website", url: null }],
    awards: 0,
    aspect: 3 / 4,
    media: [T + "love-cats.webp", T + "love-bow.webp", T + "love-favorite-person-art.webp"],
  },
  {
    title: "For Someone Special",
    slug: "for-someone-special",
    description: "A warm starting point for a birthday, anniversary, surprise, or just-because message.",
    link: null,
    tags: [{ title: "Surprise", url: null }, { title: "Personal website", url: null }],
    awards: 0,
    aspect: 4 / 5,
    media: [T + "love-of-my-life-art.webp", T + "love-paper-texture.webp", T + "love-of-my-life.webp"],
  },
  {
    title: "Our Little World",
    slug: "our-little-world",
    description: "Make a page that feels like your own shared universe, with space for photos and inside jokes.",
    link: null,
    tags: [{ title: "Us", url: null }, { title: "Personal website", url: null }],
    awards: 0,
    aspect: 4 / 5,
    media: [T + "love-cats.webp", T + "love-polaroid-frame.webp", T + "love-bow.webp"],
  },
  {
    title: "Everyday Reasons",
    slug: "everyday-reasons",
    description: "A simple way to collect the little reasons someone means the world to you.",
    link: null,
    tags: [{ title: "Message", url: null }, { title: "Personal website", url: null }],
    awards: 0,
    aspect: 4 / 5,
    media: [T + "love-favorite-person-art.webp", T + "love-paper-texture.webp", T + "love-of-my-life.webp"],
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
