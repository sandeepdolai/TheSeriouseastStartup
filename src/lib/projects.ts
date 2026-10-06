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
const P = `${BASE_PATH}/projects/`;

export const FEATURED: Project[] = [
  {
    title: "Birthday Template",
    slug: "birthday-template",
    description:
      "A handmade birthday page with a paper texture, handwritten details, a photo space, and a personal message.",
    link: null,
    tags: [{ title: "Birthday", url: null }],
    awards: 0,
    aspect: 1080 / 1550,
    media: [BASE_PATH + "/templates/birthday-template.svg"],
  },
  {
    title: "Love of My Life",
    slug: "love-of-my-life",
    description:
      "A scrapbook-style love story with a paper backdrop, two cats, a photo frame, handwritten details, and a hanging note.",
    link: null,
    tags: [{ title: "Love", url: null }],
    awards: 0,
    aspect: 1080 / 1550,
    media: [BASE_PATH + "/templates/love-of-my-life.webp"],
  },
  {
    title: "Nathan Riley",
    slug: "nathan-riley",
    description:
      "Nathan is a UK-based digital creative specializing in art direction, surrealist 3D visuals, interactive experiences, and motion design.",
    link: "https://www.nrly.co/",
    tags: [{ title: "2023", url: null }],
    awards: 0,
    aspect: 2048 / 1172,
    media: [
      P + "1786209541-nathan-thumb.mp4",
      P + "1786207557-nathan-2.jpg",
      P + "1786207557-nathan-1.jpg",
      P + "1786207557-nathan-3.jpg",
    ],
  },
  {
    title: "Casa Di Solare",
    slug: "casa-di-solare",
    description:
      "Solare extends Nikolas Type‘s Font Catalogue with a timeless, hyper-useable quintessential variable font, suitable for a wide field of applications.",
    link: "https://casadisolare.com/",
    tags: [
      { title: "Unseen", url: "https://unseen.co/" },
      { title: "2024", url: null },
    ],
    awards: 4,
    aspect: 2048 / 1204,
    media: [
      P + "1786212651-solare-thumb.mp4",
      P + "1786212741-sol-1.mp4",
      P + "1786212835-sol-2mp4.mp4",
    ],
  },
  {
    title: "The Lookback",
    slug: "the-lookback",
    description:
      "Digital capsule for Better Off® studio to document what inspired them and what they created over the last months/years.",
    link: "https://tlb.betteroff.studio/",
    tags: [
      { title: "BetterOff® Studio", url: "https://betteroff.studio/" },
      { title: "2026", url: null },
      { title: "Gil Huybrecht", url: "https://gilhuybrecht.com" },
    ],
    awards: 3,
    aspect: 1250 / 720,
    media: [
      P + "1786208843-tlb-thumbnail.mp4",
      P + "1785656624-bo2.mp4",
      P + "1785656629-image-39.jpg",
      P + "1785656633-tlb4.jpg",
    ],
  },
  {
    title: "Book of Happiness",
    slug: "book-of-happiness",
    description:
      "Helping leaders keep themselves and their people happy and mentally healthy.",
    link: "https://www.findworkhappiness.com/",
    tags: [
      { title: "2024", url: null },
      { title: "David Lubofsky", url: "https://www.davidlubofsky.com/" },
    ],
    awards: 4,
    aspect: 2048 / 1114,
    media: [
      P + "1786210053-book-thumbnail.mp4",
      P + "1786210260-book-2.jpg",
      P + "1786210260-book-3.jpg",
      P + "1786210260-book-1.jpg",
    ],
  },
  {
    title: "Dogelon Mars",
    slug: "dogelon-mars",
    description:
      "Follow the story of Dogelon Mars as he explores the greatest mysteries of the universe and seeks to return to the planet he once called home with the help of the friends he’s made during his intergalactic travels.",
    link: "https://dogelonmars.com",
    tags: [
      { title: "Griflan", url: "https://griflan.com" },
      { title: "2024", url: null },
    ],
    awards: 3,
    aspect: 3360 / 2200,
    media: [
      P + "1786207957-dogelon-2.jpg",
      P + "1786207957-dogelon-1.jpg",
      P + "1786207957-dogelon-4.jpg",
      P + "1786207957-dogelon-3.jpg",
    ],
  },
  {
    title: "Gil Huybrecht",
    slug: "gil-huybrecht",
    description:
      "Gil Huybrecht is a Belgian digital designer and art director, based around Antwerp. He specializes in typography-heavy web design, art direction, interaction design, and branding.",
    link: "https://gilhuybrecht.com",
    tags: [
      { title: "2026", url: null },
      { title: "Gil Huybrecht", url: "https://gilhuybrecht.com" },
    ],
    awards: 1,
    aspect: 1196 / 720,
    media: [
      P + "1786213274-gil-thumb.mp4",
      P + "1786213789-gil-1.mp4",
      P + "1786213860-gil-2.mp4",
    ],
  },
  {
    title: "Discoveryland",
    slug: "discoveryland",
    description:
      "Partnered with Outpost and Discovery Land Company to create an immersive, storytelling brand experience that showcasing DLCs international portfolio and capabilities while acting as a seamless transition across their 23 properties.",
    link: "https://discoverylandco.com/",
    tags: [
      { title: "Outpost", url: "https://outpost.design/" },
      { title: "2026", url: null },
    ],
    awards: 0,
    aspect: 1372 / 1029,
    media: [
      P + "1786432901-dlc-thumbnail.jpg",
      P + "1786433326-dlc-2.mp4",
      P + "1786433326-dlc-1.mp4",
    ],
  },
  {
    title: "Griflan",
    slug: "griflan",
    description:
      "Griflan is a creative studio at the intersection of design, strategy, and compelling storytelling, shaping brands that move culture and leave a lasting mark.",
    link: "https://griflan.com",
    tags: [{ title: "2026", url: null }],
    awards: 3,
    aspect: 1162 / 720,
    media: [
      P + "1786433825-griflan-2.mp4",
      P + "1786433825-griflan-3.mp4",
      P + "1786433825-griflan-1.mp4",
    ],
  },
];

export interface IndexItem {
  title: string;
  href: string;
  external: boolean;
}

/** The /full index — every project by name (featured get case studies) */
export const FULL_INDEX: IndexItem[] = [
  { title: "The Lookback", href: `${BASE_PATH}/projects/the-lookback`, external: false },
  { title: "DoThings", href: "https://dothingsnyc.com/", external: true },
  { title: "53 West 53", href: "https://53w53.com/", external: true },
  { title: "Ross Mason®", href: "https://iamrossmason.com/", external: true },
  { title: "Vucko™", href: "https://vucko.co/", external: true },
  { title: "Ingrao", href: "https://ingrao.jesperlandberg.com/", external: true },
  { title: "111 West 57th Street", href: "https://111w57.com/", external: true },
  { title: "Better Off®", href: "https://betteroff.studio/", external: true },
  { title: "Techspeed", href: "https://techspeed.com/", external: true },
  { title: "Nathan Riley", href: `${BASE_PATH}/projects/nathan-riley`, external: false },
  { title: "Dogelon Mars", href: `${BASE_PATH}/projects/dogelon-mars`, external: false },
  { title: "Discoveryland", href: `${BASE_PATH}/projects/discoveryland`, external: false },
  { title: "Griflan", href: `${BASE_PATH}/projects/griflan`, external: false },
  { title: "Book of Happiness", href: `${BASE_PATH}/projects/book-of-happiness`, external: false },
  { title: "Chris Wilcock", href: "https://www.chriswilcock.co/", external: true },
  { title: "David Lubofsky", href: "https://www.davidlubofsky.com/", external: true },
  { title: "Casa Di Solare", href: `${BASE_PATH}/projects/casa-di-solare`, external: false },
  { title: "Gil Huybrecht", href: `${BASE_PATH}/projects/gil-huybrecht`, external: false },
  { title: "Fivepathways", href: "https://fivepathways.com/", external: true },
  { title: "Energy Park", href: "https://energy-park.outpost.design/", external: true },
  { title: "Outpost", href: "https://outpost.design/", external: true },
  { title: "Mew", href: "https://mew.xyz/", external: true },
  { title: "Primland", href: "https://ownprimland.com", external: true },
];

export const SITE = {
  name: "Paper Stish",
  role: "design engineer",
  summary:
    "Jesper Landberg, Swedish design engineer, named Awwwards Independent of the Year in 2022 and 2024, building visually rich, motion-driven websites.",
  about:
    "Usually lead or sole developer, responsible for front-end architecture, animation, interaction and CMS, alongside international agencies and creative teams. Freelance, and available to studios and clients anywhere.",
  awards: "77 awards — 30× Awwwards, 40× FWA, 3× Webby, 2× Lovie.",
  email: "jesper@alpacka.studio",
  profiles: [
    { title: "Instagram", url: "https://www.instagram.com/jesperlandberg222/" },
    { title: "X", url: "https://x.com/jesper_alpacka" },
    { title: "LinkedIn", url: "https://www.linkedin.com/in/jesper-landberg-ba2984256/" },
  ],
};
