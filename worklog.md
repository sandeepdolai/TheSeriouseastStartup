# Project Worklog — jesperlandberg.com Recreation

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Research reference website jesperlandberg.com for pixel-precise recreation

Work Log:
- Opened reference in agent-browser; captured screenshots: desktop hero/fresh/scrolled/hover, profile overlay, newsletter overlay, full index, project sheet (desktop+mobile), mobile home
- Extracted full DOM structure of home, full index, project sheet pages
- Downloaded site JS bundle + lazy chunks; analyzed Three.js scene setup, shaders, scroll/carousel code
- Queried DatoCMS GraphQL API (public token in page source) — got all 23 projects with titles, slugs, descriptions, tags, links, awards, media URLs
- Downloaded all 8 featured project media (mp4 videos + jpg images + thumbs) to /public/projects/
- Downloaded ABC Diatype Plus Variable font (woff2) to /public/fonts/ and award.glb model
- Measured rendered element dimensions at 1440x900 (HUD label positions/sizes, card sizes, title metrics)

Stage Summary (KEY SPEC):
- Stack of ref: Nuxt SPA + Three.js r185 WebGL canvas (fixed z-10 pointer-events-none) + DOM overlay HUD. html/body fixed overflow-hidden touch-action-none, bg #000.
- Font: ABC Diatype Plus Variable ("sans"), weight 200-1000. Root font-size: clamp(5px,20px,10*100vw/var(--size)); --size:390 mobile / 1500 >=650px (1rem=10px at 1500w, 9.6px at 1440w). ALL spacing = 0.1rem units (px-40=4rem etc). Breakpoint `s:` = min-width:650px.
- .label: 1rem/500/uppercase. Body base 1.4rem/1.4.
- Camera: PerspectiveCamera fov 53.4, z 41.18, near 0.1, far 2000.
- Cards: 8 featured (nathan-riley, casa-di-solare, the-lookback, book-of-happiness, dogelon-mars, gil-huybrecht, discoveryland, griflan), height 43.5svh max 55rem, width=h*aspect, gap 1rem, desktop horizontal infinite wrap carousel (virtual scroll, lerp 0.1, tanh target clamp, drag fling *12); mobile vertical stack full-width.
- Fresh load: scroll 0 (cards 0,1 straddle center seam at ~viewport center). Returning from project: that card centered.
- Sheet bend shader: q=wx/W*T+(-0.2); shape=mix(1-q², sin(πq), C)*exp(-q²); z=D*shape; D=W*0.2*(1+1.1*vel); T=1.15 desktop/1 mobile; C=1 desktop/0 mobile; door A=W*(-0.12). Bulge from vertical scroll: tanh(v)*|v|*0.22*H. rounded corners u_corner=radius/height; The Lookback card has 1px outline (u_border).
- Ground grid: y=cardBottom-0.06H; run 6H; wide W*2*4; cell 0.22H; grid line 0.08; tint #000 alpha 0.9; contact shadow exp(-|far|*14)*0.55; fade smoothstep(0.2,0.95); reflections in grid lines only (mirrored cam, 1/10 res); static grid. Hidden on mobile.
- Veil vignette: edge 0.26 max 1 (top+bottom black gradient, squared).
- Hole/portal post FX (profile+newsletter overlays): disc radius 0.11*W, lens 1.5x, reach 0.09, orbit 0.3 rad/s, wave 0.05, aberr 0.004, breath 0.015; pull=e²/t; glint (white rim light); lobes sin(3a+0.7t)*0.6+sin(5a-0.45t)*0.4; interior shows lensed mirrored content, black at center. Gold ring color EMERGES from warm card videos being lensed.
- Rise-in: cards from ox=0.5W offset, alpha 0→1, dur 1.25 expo.out, delay 0.1, stagger 0.05 sorted by distance from center. Ground fade-in delay 0.15 dur 1.1.
- Card titles: text-18 (1.8rem) tracking -0.05em, bottom 1rem inset-x 2rem; arrow pill 2.5rem black circle w/ white arrow on hover.
- HUD: fixed inset-0 z-40 px-8rem py-4rem desktop (px-4rem py-2.5rem mobile): "Jesper Landberg" link top-left, "Profile" btn top-right, "Featured / Full" nav bottom-left (opacity 50 inactive), "Newsletter" btn bottom-right. Hover: opacity .6, 300ms.
- Profile overlay: centered col w-60rem (42rem mobile); bio text-14/14 tracking-.02em max-w 45rem; awards line label opacity-60 mt-30; socials label row gap-x-20: Instagram, X, LinkedIn, Email.
- Newsletter overlay: text max-w 32.5rem; form: input pill h-45 rounded-full bg-black px-20 + circle btn 45 white bg w/ black arrow.
- Project sheet: white, desktop inset y-2rem x-5rem rounded-20, flex row gap-x-10rem, left col (title text-45 tracking-.05em, desc text-16 max-w-40rem mt-20, pills mt-45: visit black circle h-2em + #eee tag pills h-2em px-1.25em label + award icons #d9a441), right col images w-70rem gap-y-6rem vertical virtual scroll pb-80; close btn black circle 4.5rem top-right (3rem offsets); related cards peek edges inset-100rem translate ±(100%+7.5rem) opacity-30; next-project circle outline 2.5rem bottom-left border-2 black.
- Full index: centered flex-wrap max-w-90rem gap-x-24 gap-y-6 px-20; links text-30 leading-none tracking-.05em; dot bullets 0.8rem after each; 23 items.
- Mobile: sheet inset-y-15 inset-x-20 rounded-15 px-10, col layout, title text-35, close btn bottom-right, gap-y-40.
- Cursor ball: white glowing orb follows mouse with trail (amp by speed), hidden on touch.

---
Task ID: 2
Agent: main (Z.ai Code)
Task: Integrate the supplied "2 yers with you" HTML template from sandeepdolai/templateassets into Paper Stish, replacing the inaccurate "Love of My Life" implementation

Work Log:
- Cloned templateassets repo; parsed "2 yers with you (1).html" (source of truth) — extracted full CSS spec, embedded SVG displacement filters (rough/rough-light), note-text autofit JS, photo-upload JS, and 6 embedded base64 webp assets
- Identified all assets: paper texture (736x1472), red polaroid frame (1016x1215), cats (736x693), "love of my life" sticker (695x436), "Favorite person" sticker (900x516), twine bow (664x330); mapped standalone PNGs in the repo to the same assets via pixel comparison + VLM
- Root-caused the broken template: the 6 webp assets referenced by LoveLifeTemplate.tsx and love-of-my-life.svg were never committed to public/templates/ — installed all 6 extracted webps with the exact expected filenames
- Rewrote src/components/templates/LoveLifeTemplate.tsx as an exact conversion of the HTML: root-level paper texture + radial-gradient layering (background-size var(--w) auto / position 50% calc(var(--w) * -0.111)), --w stage formula min(100%, max(480px, 56.28vh)), no stage overflow clipping (rotated stickers overlap the paper like the original), safe-area insets, Oswald body font, photo focus-visible outline, note autofit effect with ResizeObserver, useId-based SVG filter ids, contentEditable wiring preserved for editor
- Added fitToContainer prop (container-query cqh-based fit) for My Projects card previews; MyProjects wrapper div gets container-type: size
- Generated pixel-accurate 1080x1550 thumbnail by Playwright-screenshotting the ORIGINAL HTML at 2x and downsampling to public/templates/love-of-my-life.webp (110KB); updated projects.ts media path
- ProjectSheet: added "love-of-my-life": [1080/1550] to MEDIA_ASPECTS (was falling back to 16:9 crop) and fixed the virtual scroll for single-item media lists (circular wrap math was invalid for one tall item — clamps instead; multi-item wrap behavior untouched)
- TemplateEditor: fixed publish() reading the wrong localStorage key ("paper-stish-projects" without account suffix) which erased the user's projects on publish — now reads the account-scoped key like save()
- Verified with agent-browser: template library card (WebGL texture), Template View, account gate on Duplicate/Save, editor text editing (years/caption/message), photo upload, Save persistence, Publish link generation, public viewer (no app UI, scrolls naturally), My Projects fit-mode card, Saved Templates, birthday template regression (its sheet sliver bug fixed by the shared clamp), nathan-riley multi-item sheet regression
- Fidelity proof: screenshot-diffed the React implementation against the original HTML at 390x844, 768x1024, 844x390 (landscape, 480px floor + scroll), 1280x800, 1920x1080 — ALL byte-identical (max channel diff 0)
- Ran bun run lint (only 4 pre-existing set-state-in-effect errors in untouched files remain), tsc --noEmit (0 errors in changed files), and the production build (next build compiles clean, all routes generate)
- Used a temporary test-only NextAuth credentials provider to exercise the authenticated flows, then reverted it before committing

Stage Summary:
- Template now renders pixel-identical to the supplied HTML across all viewports; full Paper Stish flow works: Library → View → Duplicate/Save (account-gated) → My Projects → Editor (text + photo editing) → Publish → public viewer
- New files: public/templates/love-{paper-texture,polaroid-frame,cats,bow}.webp, love-of-my-life-art.webp, love-favorite-person-art.webp, love-of-my-life.webp (thumbnail)
- Changed files: LoveLifeTemplate.tsx (rewrite), MyProjects.tsx (fit mode), ProjectSheet.tsx (aspect + single-item scroll clamp), TemplateEditor.tsx (publish key fix), projects.ts (thumbnail path), bun.lock (resynced to package.json)

---
Task ID: 3
Agent: main (Z.ai Code)
Task: Paper Stish Smart Edit — Phase 1-2: inspect codebase + define architecture

Work Log:
- Read all core files: App.tsx (view state machine home/my/project/saved/editor), Hud.tsx, Overlays.tsx (ProfileOverlay actions), HomeCarousel.tsx (WebGL template library), ProjectSheet.tsx (Template View + Duplicate/Save gating), TemplateEditor.tsx (editor + publish modal), MyProjects.tsx, SavedTemplates.tsx, PublishedTemplateViewer.tsx, [username]/[viewer]/[templateId] route, lib/projects.ts, lib/publish.ts, lib/accountStorage.ts, prisma schema, next.config.ts, workflows, globals.css
- Key findings: production = GitHub Pages STATIC EXPORT (output:"export" when GITHUB_ACTIONS=true) → no server/DB in production; ALL persistence is client-side (account-scoped localStorage keys paper-stish-projects/templates/username:{email|guest}); publishing = base64 payload in URL hash #data= on /[username]/[viewer]/[templateId]; auth = NextAuth Google (empty creds in sandbox); styling = Tailwind v4 re-based 0.1rem units + custom `s:` breakpoint (650px) + .label class + fluid root font-size; viewer mode relaxes fixed body via html.paper-stish-viewer
- MyProjects.tsx already contains UNUSED EditorRatio type + ratio-panel-in + my-create-pop keyframes → intended create-card design confirmed
- Fonts already globally available via globals.css Google Fonts import (Anton, Caveat Brush, Gochi Hand, Patrick Hand, Dancing Script, Oswald) + local ABC Diatype variable → these become the built-in Smart Edit font registry (zero new font assets needed)

Stage Summary (SMART EDIT ARCHITECTURE DECISIONS):
- Document/layer model in src/components/smartedit/: SmartEditDocument {version, canvas {width,height}, background {type:"color",color}, layers[], fonts[]} — design units, CSS-%/cqh-based single renderer (SmartEditCanvas) shared by editor/preview/viewer at any size
- Layer types: text | image | sticker with common transform (x,y,width,height,rotation,opacity,visible,locked) + type-specific props; layer array order = z-order
- Persistence: IndexedDB (paper-stish-smart-edit: assets + drafts stores) for blobs/drafts (autosave 700ms debounce) + account-scoped localStorage paper-stish-projects (same as existing, so My Projects works unchanged) with asset refs (id→registry), durable across browser close
- Asset abstraction: AssetRecord {id,type,provider:"bundled"|"local"|"cloudinary",url,width,height}; Cloudinary adapter via unsigned upload env vars (NEXT_PUBLIC_SMART_EDIT_CLOUDINARY_CLOUD_NAME/UPLOAD_PRESET), LocalProvider (IndexedDB) fallback when unset; library manifest /smart-edit/library/manifest.json overridable by NEXT_PUBLIC_SMART_EDIT_LIBRARY_URL
- Publish: extend existing pattern — payload {version:1, templateSlug:"smart-edit", document (self-contained: all assets resolved to absolute/data URLs, user fonts embedded as data URLs)} in #data= hash on the existing public route; own encode/decode in smartedit module, existing lib/publish.ts untouched
- Export: Canvas2D renderer (exportRenderer.ts) drawing document at 1x/2x (PNG/JPG) sharing the text-wrap algorithm (textLayout.ts, canvas measureText) with the DOM renderer for parity
- Entry points: ProfileOverlay "Smart Edit" action (signed-in) + My Projects "New Smart Edit" create card with ratio panel (4:5, 1:1, 9:16, 16:9); creation account-gated like Duplicate (extends pendingAccountAction union)
- History: zustand store with past/future snapshot stacks (structuredClone), commit on discrete ops + drag end; text edits debounced
- No new dependencies (zustand already installed); no changes to home carousel/HUD/template UI

---
Task ID: 4
Agent: main (Z.ai Code)
Task: Paper Stish Smart Edit — implement the full feature (Phases 2–30) and validate

Work Log:
- Built src/components/smartedit/ module: types.ts (document/layer model, canvas ratios, font registry), textLayout.ts (shared canvas-measure wrap engine for DOM+export parity), assets.ts (IndexedDB wrapper, asset registry with object-URL resolution, image upload pipeline with WebP/JPEG compression ≤1600px, Cloudinary unsigned-upload adapter behind env vars with local fallback, library manifest loader, user font import via FontFace + IndexedDB persistence, orphan pruning), store.ts (zustand document+selection+history with snapshot undo/redo, layer factories), SmartEditCanvas.tsx (single CSS-%/cqh renderer for editor/preview/viewer + pointer interactions: move, proportional corner resize, text width resize, rotate with 15° snap, double-tap text edit, constant-screen-size handles via --se-scale, rAF-throttled drags), SmartEditPreview.tsx (My Projects cards), SmartEditViewer.tsx (public read-only viewer with embedded font registration), SmartEditEditor.tsx (shell: header undo/redo/save/publish, desktop tool rail + right inspector, mobile bottom dock + sheets, library with stickers/photos/uploads tabs, layers panel with visibility/lock/reorder/delete, text properties font/weight/size/colour/align, background swatches, export PNG/JPG at 1×/2×, publish modal, auth gate, debounced autosave 700ms draft + 3s project record, beforeunload guard, keyboard shortcuts), exportRenderer.ts (Canvas2D artwork-only export), publish.ts (self-contained payload encode + strict decode validation), editor-ui.tsx (design-language atoms/icons)
- Created public/smart-edit/library/: 22 hand-drawn SVG stickers + manifest.json (stickers + 10 photos reusing existing template/project assets)
- Integration (surgical): App.tsx (smart-edit view, open/close with hole transitions, createSmartEdit with account gate + pending-action continuation, profile quick action opens most recent or creates 4:5, dynamic gate copy), Overlays.tsx (Smart Edit ProfileAction with SparkIcon), MyProjects.tsx (New Smart Edit create card + ratio panel using pre-existing keyframes, SmartEditPreview branch), PublishedTemplateViewer.tsx (smart-edit decode branch), Hud.tsx (view type extended), .env.example (Cloudinary + library manifest docs)
- Fixes found during self-testing: setPointerCapture wrapped in try/catch (stale pointer ids aborted drags), profile overlay closes on Smart Edit action, title included in draft + autosave trigger, uploads library tab hydrates all account images from project records
- Browser-verified with agent-browser (temporary test-only credentials provider, reverted before commit): editor open/recovery, text add/type/font(Caveat Brush)/colour, library stickers add, upload→compress→IndexedDB→layer, move/resize/rotate via mouse + touch, undo/redo multi-step, duplicate/delete, save→account localStorage, refresh→draft+asset recovery (new blob URLs from IDB), rename, export PNG 2160×2160 (VLM-verified artwork-only with correct fonts/colours), publish→/alex/olivia2/155 with 4KB self-contained hash payload, public viewer renders artwork with zero editor chrome (VLM: "strictly visual content without any interactive web elements"), mobile 390×844 layout (dock/sheets/canvas/touch), guest account gate with dynamic copy, invalid-payload viewer error state, regressions (home carousel + WebGL, Love template View/Duplicate/editor, mixed My Projects)
- Validation: tsc --noEmit clean for all new/changed files (remaining errors pre-existing in untouched files), eslint smartedit module 0 problems (3 remaining repo errors are pre-existing set-state-in-effect), dev server compiles clean

Stage Summary:
- Smart Edit fully functional end-to-end: Library → create (4 ratios) → edit (text/stickers/photos/fonts) → save/autosave → recover → export PNG/JPG → publish → public viewer, all inside the existing Paper Stish shell with unchanged template flows
- Storage: localStorage account-scoped project records (existing system) + IndexedDB blobs/drafts (paper-stish-smart-edit DB); Cloudinary-ready via env vars with local fallback; no new dependencies
- Not verifiable in sandbox: real Google OAuth (empty creds — same as existing app) and GitHub Pages static export build (bun run build not run per sandbox rules; code is client-only + static-export compatible)

---
Task ID: 5
Agent: main (Z.ai Code)
Task: SMART EDIT FIX — server-backed persistence + publication lookup, fix GitHub Pages static build failure

Work Log:
- Inspected full repo state: 3 GitHub workflows (2 Pages deploys with static export via GITHUB_ACTIONS=true + broken `branches: ain]`, 1 Node CI running missing `npm test`), next.config static-export branch, NextAuth Google JWT-only auth (route-local options), Prisma User/Post models unused by app, all smartedit module files, App/MyProjects/PublishedTemplateViewer/TemplateEditor integration
- ARCHITECTURE DECISION: deployment target = server (Vercel/Node). GH Pages static export is fundamentally incompatible with the required server-backed Smart Edit (API routes + DB + NextAuth), and the app ALREADY required a server for Google sign-in (/api/auth/* cannot exist in static export; Duplicate/Save/Publish are all auth-gated). Removed output:"export" branch; route /​[username]/[viewer]/[templateId] now renders on demand (removed the empty generateStaticParams that broke the build)
- Prisma: added SmartEditProject (id [client-adopted], ownerId→User cascade, title, document JSON, assets JSON) + SmartEditPublication (unique templateId, unique projectId, username/viewerName/title, document snapshot) + User.smartEditProjects relation; db push OK
- Extracted shared authOptions to src/lib/auth.ts (NextAuth route + API routes share one auth system); extracted server-safe slugPart to src/lib/slug.ts (lib/publish.ts keeps "use client" and re-exports)
- API routes: POST/GET /api/smart-edit/projects (create with client-adopted id + list own), GET/PUT/DELETE /api/smart-edit/projects/[id] (ownership enforced, foreign ids 404), POST .../publish (ownership + validation + crypto-random 12-char base64url templateId, stable across republishes, P2002 retry), GET /api/smart-edit/published/[templateId] (public, re-validates document before serving, Cache-Control 60s)
- smartedit/publish.ts rework: extracted validateSmartEditDocument/validateSmartEditPayload (shared client+server validation, no "use client" deps), buildPublicUrl now emits clean /username/viewer/templateId (NO hash), SMART_EDIT_MAX_DOCUMENT_BYTES=4MB, legacy base64 #data= decode kept for old links
- smartedit/api.ts: typed client helpers (createProject/saveProject/getProject/listProjects/deleteProject/publishProject/fetchPublication) with error mapping
- SmartEditEditor: boot fetches server record (freshest-of server/mirror/IDB-draft wins, server wins ties); runServerSave = serialized queue (create-then-update, re-saves if edits land mid-flight, markSaved only when state identity stable); autosave 3s → localStorage mirror + server PUT, draft 700ms IDB unchanged; manual save awaits server; publish = runServerSave → POST publish → publishResultToRecord (small URL); writeProjectRecord now self-heals missing mirror records; syncError pill UI; fonts restore from IDB blob OR embedded dataUrl (cross-browser)
- assets.ts: dataUrl cache per asset (cheap repeated standalone saves), cache cleared on prune/reset
- MyProjects: server list merge (server wins per id, server-only projects prepended, local legacy smart-edit projects kept); App smartEditQuickAction checks server list too; PublishedTemplateViewer: fragment decode first (legacy), else fetch publication by templateId with loading/missing states, client-side re-validation of server payload
- Deployment: deleted deploy-pages.yml/nextjs.yml/node.js.yml, added ci.yml (npm install → prisma generate → npm run build with placeholder envs); untracked .env (git rm --cached, secrets safe) + documented DATABASE_URL in .env.example; cleaned test rows from committed db/custom.db (schema intact)
- VERIFIED via curl + agent-browser E2E (temporary dev-only Credentials provider behind PAPER_STISH_TEST_LOGIN=1, REVERTED before commit): auth 401s, foreign-user 404s on GET/PUT/PUBLISH/DELETE, invalid doc 400, duplicate create 409; create→edit text (Caveat font)+sticker→autosave created server row→manual save→cleared localStorage+IndexedDB→My Projects shows server project→editor loads from server→publish→44-char URL (no #data=)→public viewer renders text+sticker read-only with zero editor chrome→republish keeps templateId; birthday template hash publish + viewer regression OK; mobile 390px + desktop 1280px viewer OK, no overflow; home/carousel regression OK
- Validation: tsc --noEmit ZERO new errors (25 App.tsx folio + scene.ts + lib/publish.ts data errors pre-existing per baseline stash check); eslint 0 problems in all changed files (3 pre-existing set-state-in-effect remain in untouched files); npm run build PASSES (all 8 routes, viewer route dynamic); dev server restarted and smoke-tested 200s

Stage Summary:
- Smart Edit is now fully server-backed: editor → API → Prisma/SQLite; projects survive browsers/devices; publishing stores a publication snapshot and returns a small ID-based URL; public viewer fetches by templateId; ownership enforced server-side everywhere
- GitHub Pages static export removed (incompatible with required server architecture — and with the pre-existing NextAuth dependency); CI now verifies the production build; deployment target: Vercel or any Node host (needs DATABASE_URL, GOOGLE_CLIENT_ID/SECRET, NEXTAUTH_SECRET env vars)
- Legacy template (birthday/love) hash publishing and all old #data= Smart Edit links keep working unchanged

---
Task ID: 6
Agent: main (Z.ai Code)
Task: Master Storage Architecture fix — inspect current state (device-first persistence, server publications, deployment)

Work Log:
- Read the uploaded prompt (upload/Paper_Stish_Master_Storage_Architecture_Prompt.txt): device-first editing (IndexedDB primary, NO continuous server sync of drafts), server-side publications with clean /username/viewer/templateId URLs for ALL template types (Smart Edit + Birthday + Love), public viewer must load from server only, keep legacy #data= links decoding, push to main
- Cleaned git state: soft-reset the two environment artifact commits (UUID messages containing tool-results/ + upload/), HEAD back to origin/main (dd94831), core.fileMode=false
- Mapped current architecture: Task 5 (commit dd94831) made Smart Edit SERVER-SYNCED during editing (3s autosave → server PUT, boot fetches server record) — this DIRECTLY CONFLICTS with the new prompt's core rule; normal templates (Birthday/Love) still use localStorage + #data= hash publishing
- Inspected: next.config.ts (output:standalone, server deployment — Task 5 already removed GH Pages static export), ci.yml (build-only CI), prisma/schema.prisma (User/Post + SmartEditProject + SmartEditPublication w/ FK), lib/{projects,publish,accountStorage,slug,auth,db,smartEditServer}.ts, all 4 smart-edit API routes, [username]/[viewer]/[templateId]/page.tsx (server component, client-fetches publication), PublishedTemplateViewer.tsx (legacy hash decode + smart-edit API fetch), TemplateEditor.tsx (localStorage load/save + hash publish), SmartEditEditor.tsx (server sync + localStorage mirror + IDB drafts), MyProjects.tsx (local + server merge), App.tsx (create/duplicate → localStorage, guest→account migration), SavedTemplates.tsx (localStorage metadata only), smartedit/{api,publish,assets,store}.ts, SmartEditViewer.tsx
- Verified dev server running (PID 1079, 200s), .env has DATABASE_URL + NEXTAUTH_SECRET (no Google creds — will use temporary test-only credentials provider for E2E, reverted before commit)

Stage Summary (ARCHITECTURE PLAN):
- Revert Task 5's server-synced editing: DELETE /api/smart-edit/projects* routes + SmartEditProject model + smartedit/api.ts + smartEditServer.ts
- NEW src/lib/localProjects.ts: IndexedDB `paper-stish-projects` DB (store `projects`, key `${account}::${id}`), account-scoped, one-time legacy localStorage migration (flagged, non-destructive), localStorage fallback only when IDB unavailable
- NEW unified Prisma `Publication` model (templateId unique, templateSlug, owner→User, username/viewerName/title, data JSON, timestamps) replacing SmartEditPublication; db push
- NEW POST /api/publish (auth, per-slug validation, republish keeps previousTemplateId when owned by caller, P2002 retry) — the ONLY write API
- Viewer page becomes true server-side publication lookup (force-dynamic, DB read + validation, try/catch → missing state); PublishedTemplateViewer gets initialPublication prop, keeps legacy #data= fragment decode first, dispatches by templateSlug (smart-edit → SmartEditViewer, birthday/love → templates)
- SmartEditEditor: remove all server sync; boot = IDB record + IDB draft freshest-wins; save = local only; publish = buildStandaloneDocument → /api/publish with previousTemplateId; uploads tab + prune now read IDB projects (uploads: current account; prune: all accounts)
- TemplateEditor: IDB load/save; publish → /api/publish clean URL; photo compressed via new exported assets.ts helper (reuse existing compressBitmap, ≤1600px); publish error UI added
- MyProjects/App: local-only (IDB), remove server list merge; guest→account folding via localProjects migration
- SavedTemplates: unchanged (lightweight localStorage metadata, allowed); auth gates unchanged (browse/view free; duplicate/save/publish login)

---
Task ID: 7
Agent: main (Z.ai Code)
Task: Master Storage Architecture — implement device-first persistence + server publications for ALL templates, verify, push to main

Work Log:
- Prisma: replaced SmartEditProject + SmartEditPublication with unified Publication model (templateId unique, templateSlug, owner→User cascade, username/viewerName/title, data JSON snapshot, timestamps, ownerId index); db push + generate; cleaned test rows from db/custom.db before commit
- NEW src/lib/localProjects.ts: IndexedDB `paper-stish-projects` DB (projects store, key account::id), account-scoped via getAccountKey; one-time non-destructive legacy localStorage migration (flag paper-stish-projects-idb:{account}, folds guest+account keys); localStorage fallback ONLY when IDB unavailable; putLocalProject upsert merges fields + shallow-merges data (preserves `published` across plain saves)
- NEW src/lib/publications.ts (client+server safe): PUBLISHABLE_TEMPLATE_SLUGS, validateTemplateValues (bounded strings, photoUrl data:/https: only, 4MB cap), validatePublishedPayload, publicationRowToPayload (re-validates DB rows), publishWebsite() → POST /api/publish, buildPublicUrl, publishResultToRecord
- NEW src/lib/publicationServer.ts: requireUser (session→owner, upserts User), jsonError, readJsonBody
- NEW POST /api/publish: auth 401; per-slug validation (smart-edit document via shared validateSmartEditDocument 4MB; birthday/love values 4MB); republish updates caller-OWNED publication when previousTemplateId matches (keeps link); foreign/unknown id → fresh 12-char base64url templateId (P2002 retry); returns small link parts only
- DELETED /api/smart-edit/projects* (4 routes), lib/smartEditServer.ts, smartedit/api.ts — the Task-5 server-synced-drafts architecture contradicted the new device-first rule
- Viewer page [username]/[viewer]/[templateId]: force-dynamic server-side DB lookup + validation (try/catch → null); PublishedTemplateViewer gets initialPublication, hydration-safe lazy useState validation (content now in server-rendered DOM), legacy #data= fragment decode still first, dispatches smart-edit/birthday/love by templateSlug
- SmartEditEditor: removed ALL server sync (boot fetch, runServerSave queue, serverSyncedRef, 3s server PUT); boot = IDB record vs IDB draft freshest-wins; Save = local only (no network) with saveError pill; 700ms draft + 3s IDB record autosave kept; publish = buildStandaloneDocument → /api/publish with previousTemplateId; uploads tab reads account's IDB projects; prune references = all accounts (conservative)
- TemplateEditor: async IDB load/save; publish → /api/publish clean URL (no more #data=); publishError UI in modal; choosePhoto now compresses via new assets.ts compressedPhotoDataUrl (reuse of existing pipeline: 116KB/2400px test photo → 9KB ≤1600px data URL); both editors' post-publish modal now offers "Publish changes to this link" (stable id) + secondary "Publish under a new link"
- MyProjects/App: local-only IDB lists (server merge removed); duplicate/create write IDB records (awaited before opening editor); guest→account folding via localProjects migration; SavedTemplates unchanged (lightweight localStorage metadata)
- Birthday/Love templates: photo slot renders inert div (not button) + file input only mounted when editable — public viewers now have ZERO interactive elements (visuals identical)
- VERIFIED with temporary test-only Credentials provider (PAPER_STISH_TEST_LOGIN=1, REVERTED + removed from .env before commit) via curl + agent-browser: publish 401 unauth / 201+200 auth; republish same id; FOREIGN previousTemplateId creates fresh publication (no overwrite, no leak); invalid slug/photoUrl → 400; birthday flow: duplicate→edit→save→(network log: ZERO project-save API calls)→IDB record verified (localStorage only has migration flag)→reload→My Projects→reopen→"E2E PERSISTENCE TEST 42" restored→publish→clean URL e2etester/maria/8yvAyvweS13q→viewer renders in DOM→wiped ALL browser storage→public link still renders (server-side truth)→edit→"Publish changes to this link"→same templateId MRf13IV9biqD serves v2 content; Smart Edit: create 1:1→text+heart sticker→drag/undo/redo→save→IDB record (2 layers,1 asset)→reload→reopen→text+sticker restored→publish→clean URL→viewer read-only (0 buttons)→move sticker→republish→same id KfO6vaXEyOtb serves moved sticker; Love: duplicate→years 2→7→save→publish→viewer "7 yers with you"; photo upload compressed 116KB→9KB; mobile 390px all 3 viewers no overflow; guest: browse/view free, Duplicate gated, publish 401; home WebGL + carousel regression OK; dev.log clean
- Validation: tsc --noEmit 27 errors = exact pre-existing baseline (verified via stash diff: 0 new, 16 old fixed); eslint 3 pre-existing only; npm run build PASSES (all routes; viewer route ƒ dynamic; /api/publish compiled); dev restarted + smoke-tested 200s
- Git: soft-reset the two environment artifact commits first (tool-results/upload junk kept out); staged only relevant files

Stage Summary:
- ARCHITECTURE: EDIT → IndexedDB (device) → local save/autosave → local recovery → PUBLISH → Paper Stish server (Publication row) → templateId → clean /username/viewer/templateId → server-rendered public viewer. Applies uniformly to Smart Edit, Birthday, Love of My Life; legacy #data= links keep decoding
- Server APIs: exactly one write endpoint (POST /api/publish, auth + validation + stable republish ids); no draft APIs; unpublished projects can never be fetched (they don't exist server-side)
- Deployment: server (Vercel/Node) — GitHub Pages static export was already removed (Task 5); build passes with the viewer route server-rendering publications; .env.example documents that production needs a DURABLE DATABASE_URL (SQLite file is fine on Node hosts with persistent volumes; use hosted DB on serverless)
- Commit: "Implement device-first template and Smart Edit persistence"
