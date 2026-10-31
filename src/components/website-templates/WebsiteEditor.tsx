"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { isAdminEmail } from "@/lib/admin";
import { GUEST_ACCOUNT_KEY, getAccountKey } from "@/lib/accountStorage";
import { deleteLocalProject, getLocalProject, putLocalProject } from "@/lib/localProjects";
import {
  publishResultToRecord,
  publishWebsite,
  slugPart,
  type PublishedRecord,
  type MemoryLaneProfile,
  type TemplatePublicationValues,
} from "@/lib/publications";
import { isValidCalendarHeartDate } from "@/lib/calendarHeartValue";
import { PhotoAlbumTemplate, DEFAULT_ALBUM_CAPTIONS, DEFAULT_ALBUM_PHOTOS } from "./PhotoAlbumTemplate";
import { BirthdayTodayTemplate } from "./BirthdayTodayTemplate";
import { LoveHeartTemplate } from "./LoveHeartTemplate";
import { RedLetterTemplate } from "./RedLetterTemplate";
import { MemoryLaneTemplate, MEMORY_LANE_DEFAULT_PROFILES } from "./MemoryLaneTemplate";
import { RoseTemplate } from "./RoseTemplate";
import { IntroducingHimTemplate, INTRODUCING_HIM_DEFAULTS } from "./IntroducingHimTemplate";
import {
  FOREVER_AND_EVER_TEXT_DEFAULTS,
  ForeverAndEverTemplate,
  resolveForeverAndEverText,
} from "./ForeverAndEverTemplate";
import { OUR_CALENDAR_DEFAULT_NOTES, OurCalendarTemplate } from "./OurCalendarTemplate";
import { LoveOfMyLifeTemplate } from "./LoveOfMyLifeTemplate";
import { qrCodeMatrix, qrCodeSvgPath } from "@/lib/qrCode";
import styles from "./WebsiteEditor.module.css";

export type WebsiteEditorTemplateSlug = "memory-lane" | "love-of-my-life" | "birthday-template" | "birthday-today" | "photo-album" | "love-heart" | "forever-and-ever" | "our-calendar" | "introducing-him" | "red-letter" | "rose";

type EditableWebsiteField =
  | "heading"
  | "loveMessage"
  | "birthdayName"
  | "intro"
  | "years"
  | "yearsLabel"
  | "sideNote"
  | "noteHeading"
  | "message"
  | "signature";

const MAX_ALBUM_PHOTOS = 6;
const MAX_PHOTO_DATA_LENGTH = 560_000;
const REOPEN_PUBLISH_KEY = "paper-stish-reopen-website-publish";

const TEXT_DEFAULTS: Record<WebsiteEditorTemplateSlug, TemplatePublicationValues> = {
  "memory-lane": {
    heading: "Memory Lane",
    memoryLaneProfiles: MEMORY_LANE_DEFAULT_PROFILES,
    photoUrl: null,
    images: [],
    captions: [],
  },
  "love-of-my-life": {
    heading: "To the love of my life",
    intro: "A small corner of the internet for everything I sometimes forget to say out loud.",
    noteHeading: "If I could keep one thing forever…",
    message: "Somehow, ordinary days become the ones I want to remember most when I spend them with you. Thank you for being my safe place, my favorite hello, and the person I want beside me for all the little things still to come.",
    sideNote: "My favorite person, always",
    signature: "Always on your side",
    photoUrl: null,
    images: [],
    captions: [],
  },
  "birthday-template": {
    heading: "Happy Birthday, my favorite person",
    intro: "One little corner of the internet, made to celebrate you.",
    noteHeading: "I hope you feel how loved you are.",
    message: "I hope this next chapter brings you the same joy, kindness, and light that you bring into my life. You deserve every beautiful thing coming your way.",
    sideNote: "Today is all about you",
    signature: "Celebrating you, always",
    photoUrl: null,
    images: [],
    captions: [],
  },
  "birthday-today": {
    heading: "who’s birthday is it today?",
    birthdayName: "",
    photoUrl: null,
    images: ["", "", "", ""],
    captions: [],
  },
  "photo-album": {
    heading: "A little album of us",
    message: "The days go by quickly. These are the moments I want to keep close, one little memory at a time.",
    photoUrl: null,
    images: [],
    captions: [],
  },
  "love-heart": {
    heading: "Love Heart",
    loveMessage: "I Love You, Your Loved One Name♡",
    photoUrl: null,
    images: [],
    captions: [],
  },
  "red-letter": {
    heading: "A little letter for you",
    message: "I wanted to leave you a little reminder that you mean more to me than I always know how to say.",
    signature: "With love,",
    photoUrl: null,
    images: [],
    captions: [],
  },
  "rose": {
    heading: "We’re sorry, sir. Your order will be delivered shortly.",
    message: "",
    photoUrl: null,
    images: [],
    captions: [],
  },
  "forever-and-ever": {
    heading: FOREVER_AND_EVER_TEXT_DEFAULTS.heading,
    message: "",
    photoUrl: null,
    images: ["", "", ""],
    captions: [],
    letterParagraphs: [...FOREVER_AND_EVER_TEXT_DEFAULTS.letterParagraphs],
  },
  "our-calendar": {
    heading: "Our Calendar",
    message: "",
    photoUrl: null,
    images: ["", "", "", "", ""],
    captions: [],
    calendarNotes: [...OUR_CALENDAR_DEFAULT_NOTES],
  },
  "introducing-him": {
    heading: INTRODUCING_HIM_DEFAULTS.heading,
    message: INTRODUCING_HIM_DEFAULTS.message,
    photoUrl: null,
    images: [],
    captions: [],
  },
};

const TEMPLATE_TITLES: Record<WebsiteEditorTemplateSlug, string> = {
  "memory-lane": "Memory Lane",
  "love-of-my-life": "Love of My Life",
  "birthday-template": "Birthday Website",
  "birthday-today": "who’s birthday is it today?",
  "photo-album": "Photo Album",
  "love-heart": "Love Heart",
  "red-letter": "A Little Red Letter",
  "rose": "Rose",
  "forever-and-ever": "I love you forever and ever, my baby!",
  "our-calendar": "Our Calendar",
  "introducing-him": "Introducing Him",
};

function defaultValues(templateSlug: WebsiteEditorTemplateSlug): TemplatePublicationValues {
  const values = { ...TEXT_DEFAULTS[templateSlug] };
  if (templateSlug === "memory-lane") {
    values.memoryLaneProfiles = (TEXT_DEFAULTS["memory-lane"].memoryLaneProfiles ?? []).map((profile) => ({ ...profile }));
  }
  return values;
}

function normalizeLinkInput(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").replace(/^-+/, "").slice(0, 48);
}

async function optimizePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image such as JPG, PNG, or WEBP.");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("Each selected photo must be smaller than 15 MB.");
  }

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("Could not read this photo."));
    reader.onerror = () => reject(new Error("Could not read this photo."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("This photo could not be opened."));
    element.src = source;
  });

  const scale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo processing is not available in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.72, 0.6, 0.48, 0.38]) {
    const result = canvas.toDataURL("image/jpeg", quality);
    if (result.length <= MAX_PHOTO_DATA_LENGTH) return result;
  }
  throw new Error("This photo is too detailed to upload. Choose a smaller image.");
}

/**
 * The template itself is the editor. Photo and text interactions are attached
 * to the real website elements; there is no separate editor column or preview.
 */
export function WebsiteEditor({
  templateSlug,
  projectId,
  onClose,
}: {
  templateSlug: WebsiteEditorTemplateSlug;
  projectId: string;
  onClose: () => void;
}) {
  const { data: session, status } = useSession();
  const [values, setValues] = useState<TemplatePublicationValues>(() => defaultValues(templateSlug));
  const [username, setUsername] = useState("");
  const [websiteName, setWebsiteName] = useState(
    templateSlug === "memory-lane" ? "memory-lane" : templateSlug === "red-letter" ? "a-little-letter" : templateSlug === "introducing-him" ? "introducing-him" : templateSlug === "birthday-today" ? "birthday-today" : templateSlug === "photo-album" ? "photo-album" : templateSlug === "birthday-template" ? "birthday" : templateSlug === "love-heart" ? "love-heart" : templateSlug === "forever-and-ever" ? "forever-and-ever" : templateSlug === "rose" ? "rose" : "our-story",
  );
  const [draftReady, setDraftReady] = useState(false);
  const [draftMissing, setDraftMissing] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState("");
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const migratedLegacyDraft = useRef(false);
  const mountedRef = useRef(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState<PublishedRecord | null>(null);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [editingPublishDetails, setEditingPublishDetails] = useState(false);
  const [qrExpanded, setQrExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const publishedLinkInput = useRef<HTMLInputElement>(null);
  const targetPhotoIndex = useRef(0);
  const isMemoryLane = templateSlug === "memory-lane";
  const isAlbum = templateSlug === "photo-album";
  const isBirthdayToday = templateSlug === "birthday-today";
  const isForeverAndEver = templateSlug === "forever-and-ever";
  const isOurCalendar = templateSlug === "our-calendar";
  const title = TEMPLATE_TITLES[templateSlug];
  const showPublishResult = Boolean(published && !hasUnpublishedChanges && !editingPublishDetails);
  const linkNameIdeas = templateSlug === "introducing-him"
    ? ["introducing-him", "my-person", "for-someone-special"]
    : templateSlug === "birthday-today"
    ? ["birthday", "celebrate-you", "today-is-yours"]
    : templateSlug === "photo-album"
      ? ["our-memories", "little-moments", "photo-album"]
      : ["our-story", "for-you", "a-little-surprise"];
  const qrMatrix = useMemo(() => published?.url ? qrCodeMatrix(published!.url) : null, [published?.url]);

  useEffect(() => {
    if (!publishDialogOpen) return;

    const dialog = document.getElementById("website-publish-dialog");
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusInitial = () => {
      const target = showPublishResult ? publishedLinkInput.current : document.getElementById("website-publish-username");
      target?.focus({ preventScroll: true });
    };
    focusInitial();

    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!publishing) setPublishDialogOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]',
      )).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleDialogKeys);
    return () => {
      document.removeEventListener("keydown", handleDialogKeys);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [publishDialogOpen, showPublishResult, publishing]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;

    const restoreDraft = async () => {
      const defaults = defaultValues(templateSlug);
      const account = getAccountKey(session?.user?.email);
      let project = await getLocalProject(account, projectId);

      // A draft started before Google sign-in belongs to this device's guest
      // workspace. Promote that exact record after sign-in so nothing is lost.
      if (!project && account !== GUEST_ACCOUNT_KEY) {
        const guestProject = await getLocalProject(GUEST_ACCOUNT_KEY, projectId);
        if (guestProject) {
          const promoted = await putLocalProject({
            ...guestProject,
            account,
            updatedAt: guestProject.updatedAt ?? new Date().toISOString(),
          });
          if (promoted) {
            await deleteLocalProject(GUEST_ACCOUNT_KEY, projectId);
            project = { ...guestProject, account };
          } else {
            project = guestProject;
          }
        }
      }
      if (cancelled) return;

      let draft: Record<string, unknown> = { ...(project?.data ?? {}) };
      if (!draft.values) {
        // One-time import of pre-IndexedDB drafts created by older versions.
        // The old key is removed only after the imported content is saved.
        try {
          const legacyRaw = window.localStorage.getItem("paper-stish-website-draft:" + templateSlug);
          if (legacyRaw) {
            const legacy = JSON.parse(legacyRaw) as Record<string, unknown>;
            if (legacy.values && typeof legacy.values === "object" && !Array.isArray(legacy.values)) {
              draft = {
                ...legacy,
                ...draft,
                values: legacy.values,
                username: draft.username ?? legacy.username,
                websiteName: draft.websiteName ?? legacy.websiteName,
              };
              migratedLegacyDraft.current = true;
            }
          }
        } catch {
          // Ignore damaged legacy data and keep the new project editable.
        }
      }

      // A direct draft URL must never silently become a fresh, blank editor.
      // Newly-created drafts have a project record, while a truly missing record
      // may only proceed if a valid legacy payload was recovered above.
      const hasLegacyValues =
        draft.values && typeof draft.values === "object" && !Array.isArray(draft.values);
      if (!project && !hasLegacyValues) {
        setDraftMissing(true);
        setDraftReady(true);
        return;
      }

      const rememberedUsername = window.localStorage.getItem("paper-stish-publish-username");
      if (rememberedUsername) setUsername(rememberedUsername.slice(0, 60));

      if (draft.values && typeof draft.values === "object" && !Array.isArray(draft.values)) {
        const raw = draft.values as Record<string, unknown>;
        const text = (key: string, fallback: string, max: number) =>
          typeof raw[key] === "string" ? (raw[key] as string).slice(0, max) : fallback;
        const photoUrl =
          typeof raw.photoUrl === "string" &&
          raw.photoUrl.length <= 1_800_000 &&
          /^(data:image\/|https?:\/\/)/.test(raw.photoUrl)
            ? raw.photoUrl
            : null;
        const images = Array.isArray(raw.images)
          ? raw.images.filter((item): item is string =>
              typeof item === "string" &&
              item.length <= MAX_PHOTO_DATA_LENGTH &&
              (item === "" || /^(data:image\/|https?:\/\/)/.test(item))).slice(0, MAX_ALBUM_PHOTOS)
          : [];
        const captions = Array.isArray(raw.captions)
          ? raw.captions.filter((item): item is string => typeof item === "string").slice(0, MAX_ALBUM_PHOTOS)
          : [];
        let savedHeading = text("heading", defaults.heading ?? "", templateSlug === "introducing-him" ? 200 : 160);
        let savedMessage = text("message", defaults.message ?? "", templateSlug === "introducing-him" ? 4000 : 1200);
        if (templateSlug === "rose") {
          const legacyRoseDefaults = new Set([
            "Rose\\u0000A little reminder that you make my world bloom.",
            "For My Favorite Person\\u0000You make even the ordinary days feel soft and beautiful.",
            "Forever in Bloom\\u0000Some feelings are quiet, deep, and meant to stay.",
            "We’re sorry, sir — your order will arrive soon.\\u0000",
          ]);
          if (legacyRoseDefaults.has(`${savedHeading}\\u0000${savedMessage}`)) {
            savedHeading = defaults.heading ?? "We’re sorry, sir. Your order will be delivered shortly.";
            savedMessage = "";
          }
        }
        const savedLetterParagraphs = Array.isArray(raw.letterParagraphs)
          ? raw.letterParagraphs.filter((item): item is string => typeof item === "string").slice(0, 4)
          : defaults.letterParagraphs;
        const restoredLetterText = templateSlug === "forever-and-ever"
          ? resolveForeverAndEverText({ heading: savedHeading, letterParagraphs: savedLetterParagraphs })
          : { heading: savedHeading, letterParagraphs: savedLetterParagraphs };
        const savedCalendarNotes = Array.isArray(raw.calendarNotes)
          ? raw.calendarNotes.filter((item): item is string => typeof item === "string").slice(0, 4)
          : [];
        const restoredCalendarNotes = templateSlug === "our-calendar"
          ? OUR_CALENDAR_DEFAULT_NOTES.map((fallback, index) => savedCalendarNotes[index]?.trim()
              ? savedCalendarNotes[index].slice(0, 300)
              : fallback)
          : savedCalendarNotes;

        setValues({
          ...defaults,
          heading: restoredLetterText.heading,
          loveMessage: text("loveMessage", defaults.loveMessage ?? "", 100),
          birthdayName: text("birthdayName", defaults.birthdayName ?? "", 40),
          intro: text("intro", defaults.intro ?? "", 400),
          noteHeading: text("noteHeading", defaults.noteHeading ?? "", 240),
          signature: text("signature", defaults.signature ?? "", 160),
          years: text("years", defaults.years ?? "", 40),
          yearsLabel: text("yearsLabel", defaults.yearsLabel ?? "", 80),
          sideNote: text("sideNote", defaults.sideNote ?? "", 80),
          message: savedMessage,
          photoUrl,
          images,
          captions,
          letterParagraphs: restoredLetterText.letterParagraphs,
          calendarNotes: restoredCalendarNotes,
          memoryLaneProfiles: Array.isArray(raw.memoryLaneProfiles)
            ? raw.memoryLaneProfiles.slice(0, 6).flatMap((item): MemoryLaneProfile[] => {
                if (!item || typeof item !== "object" || Array.isArray(item)) return [];
                const profile = item as Record<string, unknown>;
                const year = typeof profile.year === "string" ? profile.year.slice(0, 4) : "";
                if (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2100) return [];
                const photoUrl = typeof profile.photoUrl === "string" &&
                  profile.photoUrl.length <= MAX_PHOTO_DATA_LENGTH &&
                  (profile.photoUrl === "" || /^(data:image\/|https?:\/\/)/.test(profile.photoUrl))
                  ? profile.photoUrl || null
                  : null;
                return [{
                  year,
                  heroTitle: typeof profile.heroTitle === "string" ? profile.heroTitle.slice(0, 80) : "",
                  photoUrl,
                }];
              })
            : defaults.memoryLaneProfiles,
          calendarHeart: isValidCalendarHeartDate(raw.calendarHeart) ? { ...raw.calendarHeart } : defaults.calendarHeart,
        });
      } else {
        setValues(defaults);
      }

      if (typeof draft.username === "string") setUsername(draft.username.slice(0, 60));
      if (typeof draft.websiteName === "string") setWebsiteName(draft.websiteName.slice(0, 60));

      const savedPublication = draft.published;
      if (
        savedPublication &&
        typeof savedPublication === "object" &&
        typeof (savedPublication as Record<string, unknown>).username === "string" &&
        typeof (savedPublication as Record<string, unknown>).viewerName === "string" &&
        typeof (savedPublication as Record<string, unknown>).templateId === "string" &&
        typeof (savedPublication as Record<string, unknown>).url === "string" &&
        typeof (savedPublication as Record<string, unknown>).publishedAt === "string"
      ) {
        setPublished(savedPublication as PublishedRecord);
      } else {
        setPublished(null);
      }
      setHasUnpublishedChanges(draft.hasUnpublishedChanges === true);

      if (window.localStorage.getItem(REOPEN_PUBLISH_KEY) === "1") {
        window.localStorage.removeItem(REOPEN_PUBLISH_KEY);
        setPublishDialogOpen(true);
      }
      setDraftReady(true);
    };

    void restoreDraft().catch(() => {
      if (!cancelled) {
        setDraftMissing(true);
        setDraftReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [templateSlug, projectId, session?.user?.email, status]);

  useEffect(() => {
    if (!draftReady || draftMissing || status === "loading") return;
    const account = getAccountKey(session?.user?.email);
    const thumbnailTitle = values.heading?.trim().slice(0, 120) || title;
    const snapshot = {
      id: projectId,
      account,
      title: thumbnailTitle,
      templateSlug,
      updatedAt: new Date().toISOString(),
      data: {
        kind: "website-template",
        values,
        username,
        websiteName,
        published,
        hasUnpublishedChanges,
      },
    };

    // Serialize writes so rapid typing cannot let an older snapshot overwrite
    // a newer one. IndexedDB is the primary store; no draft is sent server-side.
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        const saved = await putLocalProject(snapshot);
        if (saved && migratedLegacyDraft.current) {
          try {
            window.localStorage.removeItem("paper-stish-website-draft:" + templateSlug);
            migratedLegacyDraft.current = false;
          } catch {
            // Keeping the one-time legacy key is harmless if cleanup is blocked.
          }
        }
        if (mountedRef.current) {
          setDraftSaveError(saved
            ? ""
            : "Paper Stish couldn't save this draft on your device. Check browser storage before continuing.");
        }
      });
  }, [
    draftReady,
    draftMissing,
    projectId,
    templateSlug,
    title,
    values,
    username,
    websiteName,
    published,
    hasUnpublishedChanges,
    session?.user?.email,
    status,
  ]);

  const changeText = (field: EditableWebsiteField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setHasUnpublishedChanges(true);
  };

  const changeMemoryLaneProfiles = (profiles: MemoryLaneProfile[]) => {
    setValues((current) => ({ ...current, memoryLaneProfiles: profiles }));
    setHasUnpublishedChanges(true);
  };

  const changeCaption = (index: number, value: string) => {
    setValues((current) => {
      const captions = [
        ...(current.captions ?? []),
        ...DEFAULT_ALBUM_CAPTIONS.slice(current.captions?.length ?? 0),
      ].slice(0, MAX_ALBUM_PHOTOS);
      captions[index] = value;
      return { ...current, captions };
    });
    setHasUnpublishedChanges(true);
  };

  const openPhotoChooser = (index: number) => {
    targetPhotoIndex.current = index;
    fileInput.current?.click();
  };

  const choosePhotoFile = async (file: File) => {
    setPhotoLoading(true);
    setError("");
    try {
      const optimized = await optimizePhoto(file);
      if (isAlbum) {
        const index = Math.min(MAX_ALBUM_PHOTOS - 1, targetPhotoIndex.current);
        setValues((current) => {
          const savedImages = current.images ?? [];
          const photos = [...savedImages, ...DEFAULT_ALBUM_PHOTOS.slice(savedImages.length)].slice(0, MAX_ALBUM_PHOTOS);
          photos[index] = optimized;
          const savedCaptions = current.captions ?? [];
          const captions = [
            ...savedCaptions,
            ...DEFAULT_ALBUM_CAPTIONS.slice(savedCaptions.length),
          ].slice(0, MAX_ALBUM_PHOTOS);
          return { ...current, images: photos, captions };
        });
      } else if (isBirthdayToday) {
        const index = Math.max(0, Math.min(3, targetPhotoIndex.current));
        setValues((current) => {
          const images = Array.from({ length: 4 }, (_, i) => current.images?.[i] ?? "");
          images[index] = optimized;
          return { ...current, images };
        });
      } else if (isForeverAndEver) {
        const index = Math.max(0, Math.min(2, targetPhotoIndex.current));
        setValues((current) => {
          const images = [...(current.images ?? [])];
          while (images.length < 3) images.push("");
          images[index] = optimized;
          return { ...current, images };
        });
      } else if (isOurCalendar) {
        const index = Math.max(0, Math.min(4, targetPhotoIndex.current));
        setValues((current) => {
          const images = Array.from({ length: 5 }, (_, i) => current.images?.[i] ?? "");
          images[index] = optimized;
          return { ...current, images };
        });
      } else {
        setValues((current) => ({ ...current, photoUrl: optimized }));
      }
      setHasUnpublishedChanges(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use this photo.");
    } finally {
      setPhotoLoading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const choosePhoto = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (file) await choosePhotoFile(file);
  };

  const publish = async () => {
    if (status === "loading" || publishing || photoLoading) return;

    const safeUsername = slugPart(username, "");
    const safeWebsiteName = slugPart(websiteName, "");
    if (!safeUsername || !safeWebsiteName) {
      setError("Add a username and link name using letters or numbers.");
      return;
    }

    if (status !== "authenticated" || !session?.user) {
      try {
        window.localStorage.setItem(REOPEN_PUBLISH_KEY, "1");
      } catch {
        // The direct editor state will still be kept as a local draft.
      }
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      void signIn("google", {
        callbackUrl:
          window.location.origin +
          basePath +
          "/website-templates/" +
          encodeURIComponent(templateSlug) +
          "/edit?draft=" +
          encodeURIComponent(projectId),
      });
      return;
    }

    // Check Pro before the publish helper uploads local photos to Cloudinary.
    // The /api/publish route independently enforces this on the server as well.
    if (!isAdminEmail(session.user.email)) {
      try {
        const billingResponse = await fetch("/api/billing/status", { cache: "no-store" });
        const billing = await billingResponse.json() as { isPremium?: boolean };
        if (!billingResponse.ok || billing.isPremium !== true) {
          setError("Website publishing requires Pro. Your draft is saved and has not been uploaded.");
          return;
        }
      } catch {
        setError("Could not verify your Pro subscription. Your draft is unchanged; try again.");
        return;
      }
    }

    setPublishing(true);
    setError("");
    try {
      const result = await publishWebsite({
        templateSlug,
        title: values.heading?.trim().slice(0, 120) || title,
        username: safeUsername,
        viewerName: safeWebsiteName,
        ...(published?.templateId ? { previousTemplateId: published.templateId } : {}),
        data: { values },
      });
      const record = publishResultToRecord(result);
      setPublished(record);
      setQrExpanded(false);
      setCopyStatus("");
      setHasUnpublishedChanges(false);
      setEditingPublishDetails(false);
      try {
        window.localStorage.setItem("paper-stish-publish-username", record.username);
      } catch {
        // Optional convenience value.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish this website. Try again.");
    } finally {
      setPublishing(false);
    }
  };

  const copyLink = async () => {
    if (!published) return;
    try {
      await navigator.clipboard.writeText(published!.url);
      setCopyStatus("Link copied.");
    } catch {
      publishedLinkInput.current?.focus();
      publishedLinkInput.current?.select();
      setCopyStatus("Select the link and copy it.");
    }
  };

  const shareLink = async () => {
    if (!published) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url: published!.url });
        return;
      } catch (shareError) {
        if (shareError instanceof Error && shareError.name === "AbortError") return;
      }
    }
    await copyLink();
  };

  const saveQrCode = () => {
    const publication = published;
    if (!publication || !qrMatrix) {
      setCopyStatus("This link is too long to encode as a QR code.");
      return;
    }
    const quietZone = 4;
    const scale = 12;
    const dimension = (qrMatrix.length + quietZone * 2) * scale;
    const canvas = document.createElement("canvas");
    canvas.width = dimension;
    canvas.height = dimension;
    const context = canvas.getContext("2d");
    if (!context) {
      setCopyStatus("Could not prepare the QR image in this browser.");
      return;
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, dimension, dimension);
    context.fillStyle = "#111318";
    for (let y = 0; y < qrMatrix.length; y += 1) {
      for (let x = 0; x < qrMatrix.length; x += 1) {
        if (qrMatrix[y][x]) context.fillRect((x + quietZone) * scale, (y + quietZone) * scale, scale, scale);
      }
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        setCopyStatus("Could not create the QR image. Please try again.");
        return;
      }
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `paperstish-qr-${publication.username}-${publication.viewerName}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
      setCopyStatus("QR code saved as PNG.");
    }, "image/png");
  };

  if (draftMissing) {
    return (
      <main
        className={styles.screen}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          display: "grid",
          placeItems: "center",
          padding: "28px",
          background: "#0a0a0a",
          color: "#fff",
          textAlign: "center",
        }}
      >
        <div style={{ width: "min(100%, 420px)" }}>
          <p style={{ fontSize: 23, letterSpacing: "-0.04em", margin: "0 0 10px" }}>
            Draft not found on this device
          </p>
          <p style={{ color: "rgba(255,255,255,.58)", fontSize: 13, lineHeight: 1.65, margin: "0 auto" }}>
            This link stores the draft ID, not the draft content. Open it in the same
            browser and device where you edited it, or return to the template gallery.
          </p>
          <button
            type="button"
            onClick={onClose}
            style={{
              marginTop: 24,
              minHeight: 44,
              padding: "0 20px",
              borderRadius: 999,
              border: 0,
              background: "#fff",
              color: "#111",
              fontSize: 13,
              fontWeight: 650,
              cursor: "pointer",
            }}
          >
            Back to template
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      <input
        ref={fileInput}
        className={styles.hiddenInput}
        type="file"
        accept="image/*"
        aria-label="Choose a replacement website photo"
        onChange={(event) => void choosePhoto(event.currentTarget.files)}
      />

      {isMemoryLane ? (
        <MemoryLaneTemplate
          values={values}
          editing
          onProfilesChange={changeMemoryLaneProfiles}
          onExit={onClose}
        />
      ) : templateSlug === "red-letter" ? (
        <RedLetterTemplate values={values} editing onTextChange={changeText} onExit={onClose} />
      ) : templateSlug === "introducing-him" ? (
        <IntroducingHimTemplate values={values} editing onTextChange={changeText} onPhotoClick={() => openPhotoChooser(0)} onExit={onClose} />
      ) : templateSlug === "love-heart" ? (
        <LoveHeartTemplate
          values={values}
          editing
          onTextChange={changeText}
          onPhotoSelected={choosePhotoFile}
          onExit={onClose}
        />
      ) : templateSlug === "rose" ? (
        <RoseTemplate values={values} editing onTextChange={changeText} onExit={onClose} />
      ) : templateSlug === "birthday-today" ? (
        <BirthdayTodayTemplate
          values={values}
          editing
          onBirthdayNameChange={(value) => changeText("birthdayName", value)}
          onPhotoClick={openPhotoChooser}
          onPhotoFile={(index, file) => {
            targetPhotoIndex.current = index;
            void choosePhotoFile(file);
          }}
          onPhotoRemove={(index) => {
            setValues((current) => {
              const images = Array.from({ length: 4 }, (_, i) => current.images?.[i] ?? "");
              images[index] = "";
              return { ...current, images };
            });
            setHasUnpublishedChanges(true);
          }}
          onExit={onClose}
        />
      ) : isOurCalendar ? (
        <OurCalendarTemplate
          values={values}
          editing
          onNotesChange={(index, value) => {
            setValues((current) => {
              const calendarNotes = [...(current.calendarNotes ?? OUR_CALENDAR_DEFAULT_NOTES)];
              while (calendarNotes.length < 4) calendarNotes.push(OUR_CALENDAR_DEFAULT_NOTES[calendarNotes.length]);
              calendarNotes[index] = value;
              return { ...current, calendarNotes };
            });
            setHasUnpublishedChanges(true);
          }}
          onHeartChange={(calendarHeart) => {
            setValues((current) => ({ ...current, calendarHeart }));
            setHasUnpublishedChanges(true);
          }}
          onPhotoClick={openPhotoChooser}
          onPhotoFile={(index, file) => {
            targetPhotoIndex.current = index;
            void choosePhotoFile(file);
          }}
          onPhotosReset={() => {
            setValues((current) => ({ ...current, images: ["", "", "", "", ""] }));
            setHasUnpublishedChanges(true);
          }}
          onExit={onClose}
        />
      ) : isForeverAndEver ? (
        <ForeverAndEverTemplate
          values={values}
          editing
          onTextChange={changeText}
          onParagraphChange={(index, value) => {
            setValues((current) => {
              const letterParagraphs = [...(current.letterParagraphs ?? ["", "", "", ""])];
              while (letterParagraphs.length < 4) letterParagraphs.push("");
              letterParagraphs[index] = value;
              return { ...current, letterParagraphs };
            });
            setHasUnpublishedChanges(true);
          }}
          onPhotoClick={openPhotoChooser}
          onExit={onClose}
        />
      ) : isAlbum ? (
        <PhotoAlbumTemplate
          values={values}
          title={values.heading}
          editing
          onTextChange={changeText}
          onCaptionChange={changeCaption}
          onPhotoClick={openPhotoChooser}
          onExit={onClose}
        />
      ) : (
        <LoveOfMyLifeTemplate
          values={values}
          title={values.heading}
          variant={templateSlug === "birthday-template" ? "birthday" : "love"}
          editing
          onTextChange={changeText}
          onPhotoClick={openPhotoChooser}
          onExit={onClose}
        />
      )}

      <button
        type="button"
        className={styles.publishButton}
        onClick={() => {
          setEditingPublishDetails(false);
          setError("");
          setPublishDialogOpen(true);
        }}
      >
        {published && !hasUnpublishedChanges ? "Share website" : "Publish website"}
      </button>

      {photoLoading && <p className={styles.notice} role="status">Preparing photo…</p>}
      {draftSaveError && <p className={styles.notice} role="alert">{draftSaveError}</p>}
      {error && !publishDialogOpen && <p className={styles.notice} role="alert">{error}</p>}

      {publishDialogOpen && (
        <div
          className={`${styles.dialogBackdrop} ${showPublishResult ? styles.successBackdrop : styles.linkEditorBackdrop}`}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !publishing) setPublishDialogOpen(false);
          }}
        >
          <form
            id="website-publish-dialog"
            className={`${styles.dialog} ${showPublishResult ? styles.successDialog : styles.linkEditorDialog}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="website-publish-title"
            onSubmit={(event) => {
              event.preventDefault();
              if (showPublishResult) {
                setPublishDialogOpen(false);
                return;
              }
              void publish();
            }}
          >
            <button
              type="button"
              className={styles.dialogClose}
              aria-label="Close publish dialog"
              disabled={publishing}
              onClick={() => setPublishDialogOpen(false)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            {showPublishResult ? (
              <section className={styles.successView} aria-labelledby="website-publish-title">
                <div className={styles.successMark} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9.5" />
                    <path d="m7.5 12.3 3.1 3.1 6.2-6.5" />
                  </svg>
                </div>
                <h2 id="website-publish-title" className={styles.dialogTitle}>Your website is live.</h2>
                <p className={styles.dialogCopy}>Anyone with this link can view it. Your design remains editable.</p>

                <p className={styles.linkLabel}>YOUR WEBSITE LINK</p>
                <div className={`${styles.urlPreview} ${styles.urlPreviewLive}`}>
                  <svg className={styles.urlLock} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="9" rx="2.5" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input
                    ref={publishedLinkInput}
                    className={styles.publishedLink}
                    value={published!.url}
                    readOnly
                    aria-label="Published website link"
                  />
                </div>

                <button type="button" className={styles.successCopyAction} onClick={() => void copyLink()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="8.5" y="8.5" width="11" height="12" rx="2" />
                    <path d="M15.5 8.5V5.75A1.75 1.75 0 0 0 13.75 4h-8A1.75 1.75 0 0 0 4 5.75v8A1.75 1.75 0 0 0 5.75 15.5H8.5" />
                  </svg>
                  {copyStatus === "Link copied." ? "Copied!" : "Copy link"}
                </button>

                <div className={styles.dialogActions}>
                  <button type="button" className={styles.secondaryAction} onClick={() => void shareLink()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="18" cy="5" r="2.2" />
                      <circle cx="6" cy="12" r="2.2" />
                      <circle cx="18" cy="19" r="2.2" />
                      <path d="m8 11 7.8-4.7M8 13l7.8 4.7" />
                    </svg>
                    Share
                  </button>
                  <a className={styles.secondaryAction} href={published!.url} target="_blank" rel="noreferrer">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M13 5h6v6M19 5l-9 9" />
                      <path d="M18 13.5v4A1.5 1.5 0 0 1 16.5 19h-11A1.5 1.5 0 0 1 4 17.5v-11A1.5 1.5 0 0 1 5.5 5h4" />
                    </svg>
                    Open website
                  </a>
                </div>

                <button
                  type="button"
                  className={styles.qrToggle}
                  aria-expanded={qrExpanded}
                  aria-controls="published-qr-panel"
                  onClick={() => setQrExpanded((expanded) => !expanded)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3M21 14v.01M14 21h3M21 17v4h-3" />
                  </svg>
                  {qrExpanded ? "Hide QR code" : "Show QR code"}
                  <span className={styles.qrToggleChevron} aria-hidden="true">{qrExpanded ? "−" : "+"}</span>
                </button>

                {qrExpanded && (
                  <div id="published-qr-panel" className={styles.qrPanel}>
                    <div className={styles.qrArtwork}>
                      {qrMatrix ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox={`0 0 ${qrMatrix.length + 8} ${qrMatrix.length + 8}`}
                          role="img"
                          aria-label={`QR code for ${published!.url}`}
                          shapeRendering="crispEdges"
                        >
                          <rect width="100%" height="100%" fill="#ffffff" />
                          <path d={qrCodeSvgPath(qrMatrix)} fill="#111318" />
                        </svg>
                      ) : (
                        <p className={styles.qrUnavailable}>QR code unavailable for this link.</p>
                      )}
                    </div>
                    <div className={styles.qrDetails}>
                      <strong>Scan to open your website</strong>
                      <span>{published!.url}</span>
                      <button type="button" className={styles.qrSaveButton} onClick={saveQrCode} disabled={!qrMatrix}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 3v12m-5-5 5 5 5-5M5 17v3h14v-3" />
                        </svg>
                        Save as PNG
                      </button>
                    </div>
                  </div>
                )}

                {copyStatus && <p className={styles.statusLine} role="status">{copyStatus}</p>}
                <button type="button" className={styles.backToEditingAction} onClick={() => setPublishDialogOpen(false)}>Back to editing</button>
                <p className={styles.publishedNote}>Your website stays published when you return to editing.</p>
                <button type="button" className={styles.textAction} onClick={() => { setCopyStatus(""); setEditingPublishDetails(true); }}>Edit link details</button>
              </section>
            ) : (
              <section className={styles.publishFormView} aria-labelledby="website-publish-title">
                <p className={styles.dialogEyebrow}><span className={styles.eyebrowDot} /> ONE LITTLE LINK, ALL YOURS</p>
                <h2 id="website-publish-title" className={styles.dialogTitle}>Make it shareable.</h2>
                <p className={styles.dialogCopy}>Choose an address for your website. Your design and edits will stay exactly as you made them.</p>

                <div className={styles.publishFields}>
                  <label className={styles.publishField} htmlFor="website-publish-username">
                    <span className={styles.fieldMeta}>Your username <small>{username.length}/48</small></span>
                    <span className={styles.inputShell}>
                      <span className={styles.inputPrefix}>@</span>
                      <input
                        id="website-publish-username"
                        className={styles.textInput}
                        value={username}
                        maxLength={48}
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        onChange={(event) => setUsername(normalizeLinkInput(event.target.value))}
                        onBlur={() => setUsername(slugPart(username, ""))}
                        placeholder="yourname"
                        required
                      />
                    </span>
                  </label>

                  <div className={styles.publishField}>
                    <label className={styles.fieldMeta} htmlFor="website-publish-link-name">
                      Link name <small>{websiteName.length}/48</small>
                    </label>
                    <label className={styles.inputShell} htmlFor="website-publish-link-name">
                      <span className={styles.inputPrefix}>/</span>
                      <input
                        id="website-publish-link-name"
                        className={styles.textInput}
                        value={websiteName}
                        maxLength={48}
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        onChange={(event) => setWebsiteName(normalizeLinkInput(event.target.value))}
                        onBlur={() => setWebsiteName(slugPart(websiteName, ""))}
                        placeholder="our-story"
                        required
                      />
                    </label>
                    <div className={styles.ideas}>
                      <span className={styles.ideaLabel}>Ideas</span>
                      {linkNameIdeas.map((idea) => (
                        <button key={idea} type="button" className={styles.ideaChip} onClick={() => setWebsiteName(idea)}>{idea}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {error && <p className={styles.error} role="alert">{error}</p>}
                {error.toLowerCase().includes("requires pro") && (
                  <a href="/upgrade" className={styles.primaryAction}>
                    Unlock Pro
                  </a>
                )}
                <button
                  type="submit"
                  className={styles.primaryAction}
                  disabled={publishing || photoLoading || status === "loading"}
                >
                  {publishing ? (
                    <>
                      <span className={styles.buttonSpinner} aria-hidden="true" />
                      Publishing…
                    </>
                  ) : (
                    <>
                      {status === "authenticated" ? (published ? "Update website" : "Publish website") : "Sign in and publish"}
                      <svg className={styles.buttonArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </>
                  )}
                </button>
                <p className={styles.dialogFootnote}><span className={styles.footnoteDot} /> Your draft stays on this device while you edit.</p>
              </section>
            )}
          </form>
        </div>
      )}
    </main>
  );
}
