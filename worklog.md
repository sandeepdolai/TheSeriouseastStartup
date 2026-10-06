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
