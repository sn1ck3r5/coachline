# Coachline Design System Migration — Design Spec

**Date:** 2026-04-19
**Scope:** 3c — Full visual system migration (tokens + primitives) across both web and mobile, plus net-new screens from the design source.
**Source designs:** `Coachline.zip` → `coachline-design/Coachline Dashboard.html` and `Coachline Mobile.html` (polished dark-violet mockups from Claude Design)

## Goal

Replace the current ad-hoc dark styling (`#0a0a0a` flat bg, Geist fonts, inline utility classes) with a coherent design system derived from the provided mockups. The system must live in `@coachline/shared` so web and mobile consume the same tokens, and all main app screens must be re-skinned to match the mockup aesthetic. Add the net-new screens in the mockups that don't yet exist in the app.

## Non-goals

- Changing product behavior, data fetching, auth flows, routing, or API contracts
- Net-new business features (no new endpoints, no new Prisma models)
- Replacing Recharts on web or victory-native on mobile — reuse existing chart stacks
- Full mobile device-frame simulation — we target real iOS/Android shells, not the HTML iOS chrome

## Current state

- **Web** (`apps/web`): Next.js 16 + Tailwind v4 + Geist Sans / Geist Mono, flat `#0a0a0a` bg, no token layer. Screens: `(auth)/{login,signup,callback}`, `(dashboard)/{page,lessons,lessons/[id],goals,goals/[id],record,profile}`.
- **Mobile** (`apps/mobile`): Expo 54 + NativeWind + react-native-svg + victory-native. Already has component files that match the mockup taxonomy: `HighlightCard`, `LessonTimeline`, `GoalProgressChart`, `StatCard`, `AudioPlayer`, `AudioRecorder`. Tab screens: `(tabs)/{index,record,lessons,goals,profile}`, plus `(auth)/{welcome,login,voice-enrollment}`.
- **Shared** (`packages/shared`): exists and is already imported by both apps.

## Design tokens (authoritative palette)

Derived directly from the mockups.

```
# Surfaces (dark)
bg:       #0d0b12        (app background)
surface0: #100d18        (sidebar)
surface1: #161320        (cards, inputs)
surface2: #1e1b2a        (primary card)
surface3: #252233        (card hover, skeleton)

# Borders
border:   rgba(255,255,255,0.06)
borderH:  rgba(255,255,255,0.11)

# Text
text:     #f0edf8
text2:    #9a96aa         (secondary)
text3:    #5c5870         (tertiary / section labels)

# Accents
violet:   #9b7ff4         (primary)
violetL:  #b8a4f9
violetDim:rgba(155,127,244,0.14)
amber:    #f5a623         amberDim:  rgba(245,166,35,0.12)
green:    #4ade80         greenDim:  rgba(74,222,128,0.11)
indigo:   #818cf8         indigoDim: rgba(129,140,248,0.13)
red:      #f87171         redDim:    rgba(248,113,113,0.11)
group:    #60a5fa

# Radii
sm: 8   md: 10   lg: 12   xl: 14   2xl: 16   3xl: 20   pill: 9999

# Typography
sans:   "DM Sans", system-ui, sans-serif
mono:   "DM Mono", ui-monospace, monospace
scale:  9 | 10 | 11 | 12 | 13 | 14 | 15 | 18 | 22 | 26 | 28 | 32 | 34 | 40 | 52
labelCaps: {size:11, weight:700, letterSpacing:0.09em, uppercase:true, color:text3}

# Gradients
primaryCta:  linear-gradient(135deg, #9b7ff4, #7c5ce0)
greenCta:    linear-gradient(135deg, #4ade80, #22c55e)
goalReached: linear-gradient(135deg, #0f1f12, #141f18)
goalActive:  linear-gradient(135deg, #130f1f, #1a1528)
```

## Architecture

### Token module (`packages/shared/src/theme.ts`)

Exports plain JS objects (no runtime dependencies) so both Tailwind (web) and NativeWind (mobile) can consume them:

```ts
export const colors = { bg, surface: [s0,s1,s2,s3], text:[t,t2,t3], border:{…}, accent:{violet,…} };
export const radii  = { sm, md, lg, xl, xl2, xl3 };
export const type   = { sans, mono, scale, labelCaps };
export const shadow = { card, modal, cta };
```

### Web integration

- `apps/web/src/app/globals.css` extends Tailwind v4 `@theme` with:
  ```css
  @theme {
    --color-bg: #0d0b12;
    --color-surface-1: #161320;
    --color-accent-violet: #9b7ff4;
    /* … */
    --font-sans: "DM Sans", ...;
    --font-mono: "DM Mono", ...;
  }
  ```
- Then all styling uses Tailwind utilities: `bg-surface-1`, `text-muted`, `border-subtle`, `font-mono`, `text-label`.
- Swap `next/font/google` import from Geist → DM Sans + DM Mono.

### Mobile integration

- `apps/mobile/tailwind.config.js` imports tokens from `@coachline/shared/theme` and extends NativeWind theme.
- `apps/mobile/app/_layout.tsx` loads DM Sans / DM Mono via `expo-font`.
- Components use NativeWind `className` strings (`bg-surface-1 text-primary`) where possible; fall back to `style` for RN-only concerns (animations, SVG).

## Primitives (shared taxonomy)

Each has a web version (`apps/web/src/components/ui/`) and mobile version (`apps/mobile/components/ui/`). Same name, same props.

| Name | Purpose | Key props |
|---|---|---|
| `StatPill` | Label + mono-numeric value + optional sub-note, colored accent | `label, value, sub?, color?` |
| `SectionLabel` | Uppercase tracking-wide tertiary-color label | `children` |
| `Badge` | Small pill with color-tinted bg/border | `color, children` |
| `StatusBadge` | Badge preset for `completed|processing|failed|active|paused` | `status` |
| `BackBtn` | Ghost button with `←` | `onClick/onPress` |
| `Sparkline` | SVG path + area + end dot | `data, color, height, width` |
| `TalkBar` | Stacked horizontal talk-time mini-bar | `teacher, student, group?, silence?` |
| `Card` | `surface-2` bg, radius-xl, subtle border | `hover?, children` |
| `Button` | Gradient primary / ghost / danger | `variant, onClick, children` |
| `Dropzone` | Dashed-border file picker (web-only) | `accept, onFile` |

Primitives are **dumb** — tokens only, no app state, no data fetching. Each gets a snapshot test on mobile and a render test on web using existing test infra if present (else skip).

## Screen-by-screen migration

### Web (port existing)

| Current file | Maps to mockup | Net-new bits |
|---|---|---|
| `(dashboard)/page.tsx` | Home | Active-goal gradient card, sparkline, stat pills, greeting header, "New Recording" gradient CTA |
| `(dashboard)/lessons/page.tsx` | Lessons | Date badge tile, talk-split bar, 4 summary stat pills |
| `(dashboard)/lessons/[id]/page.tsx` | Lesson Report | Hero 4-stat grid, stacked talk-time bar w/ legend + insight, **minute-by-minute lesson timeline with highlight pins**, questions breakdown bars, wait-time cards, highlight cards (3-px accent bar + excerpt + insight), **cross-lesson trend mini-bar-charts**, reflection prompts, chat-bubble transcript w/ tag badges |
| `(dashboard)/goals/page.tsx` | Goals | Progress chart + per-lesson dot grid, practice-area descriptions, new-goal form |
| `(dashboard)/record/page.tsx` | Record | Audio/video toggle cards, phase-based center stage (idle→recording→stopped→uploading→done), waveform bars, dashed dropzone, tip card |
| `(dashboard)/profile/page.tsx` | Profile | Account card, voice-enrollment status, notifications toggle, **FERPA danger-zone delete confirmation modal** |
| `(dashboard)/layout.tsx` | Sidebar | Logo + nav + user footer + gradient record button |

### Mobile (port existing)

| Current file | Maps to mockup |
|---|---|
| `(tabs)/index.tsx` | HomePhone — greeting, 3 stat row, active goal card, recent lessons list |
| `(tabs)/record.tsx` | RecordPhone — center-stage timer, waveform, REC badge, red record/stop circle |
| `(tabs)/lessons/index.tsx` | LessonsPhone — summary stats, lesson cards with talk mini-bar |
| `(tabs)/lessons/[id].tsx` | ReportPhone — 2x2 stats, talk-time bar, highlighted moments, reflection |
| `(tabs)/goals/index.tsx` | GoalsPhone — active-goal card with chart + dot grid, completed/paused list |
| `(tabs)/profile.tsx` | Profile — reuse existing, restyle with tokens |
| `(tabs)/_layout.tsx` | TabBar — center record button, violet active tint |
| `(auth)/voice-enrollment.tsx` | EnrollmentScreen — **verify it's the 3-step wizard; rebuild if not** |

### Net-new screens

| Screen | Surface | Where it plugs in |
|---|---|---|
| Processing pipeline (5 stages + "Did you know" research tip) | web + mobile | Shown at `/lessons/[id]` when recording status ∈ `{uploaded, transcribing, classifying, analyzing, generating}`. Replaces current "processing" placeholder. |
| Completion reveal modal (staged fade-up with 4 stats) | web + mobile | Triggered on home/lessons when a report transitions `processing→completed` since last visit. Local storage flag to avoid re-firing. |
| Empty / first-run home (3-step onboarding) | web + mobile | Rendered from home route when user has zero completed lessons. |

## Phase plan (commit boundaries)

Each phase ends with a green `typecheck` + `lint` and a commit. If we pause, we pause between phases.

1. **Tokens** — `packages/shared/src/theme.ts`, web `globals.css` `@theme` block, mobile NativeWind config, DM Sans/Mono font loading (web + mobile). Verify: existing screens still render (may look janky — expected).
2. **Primitives** — web `components/ui/*` and mobile `components/ui/*` for the 10 primitives above. Verify: primitives render in isolation on both.
3. **Web screens** — port 6 screens (home, lessons, lesson report, goals, record, profile) + sidebar layout, using primitives. Verify: `next build` passes, manual eyeball at each route.
4. **Mobile screens** — port 6 tab screens + tab bar, using primitives. Verify: Expo bundler runs clean, `tsc` passes.
5. **Net-new screens** — processing pipeline, completion reveal modal, empty/first-run home on both surfaces. Voice-enrollment rebuild if needed. Verify: route to each, confirm triggers work.

## Success criteria

- Both apps build (`turbo build`) without new errors
- Both apps typecheck (`turbo typecheck`) without new errors
- `packages/shared/src/theme.ts` is the single source of token truth; no hardcoded hex values in any screen file
- DM Sans is the default sans font on both surfaces
- All 6 main screens per surface visually match the mockup to "close enough" fidelity (same layout, same colors, same primitives) — pixel-perfect is out of scope
- Processing, completion reveal, and empty-home are reachable and render correctly
- Existing auth, data fetching, navigation, and API contracts unchanged

## Risks + mitigations

- **Tailwind v4 `@theme` is new** — if the syntax doesn't resolve cleanly, fall back to CSS variables + `theme.extend` via the config file
- **NativeWind + dynamic tokens** — NativeWind 4 supports CSS-variable-like tokens; if not, compute `StyleSheet` objects from the shared theme and pass `style={}` directly
- **DM Sans on mobile** — must preload via `expo-font` before first render; add `SplashScreen.preventAutoHideAsync()` gate if not already present
- **Lesson timeline SVG** — complex SVG on web is straightforward; on mobile use `react-native-svg` (already a dep)
- **Chart library drift** — web has Recharts, mobile has victory-native. The mockup's mini-bar charts and sparklines are simple enough to hand-roll with SVG to avoid coupling to either library for these primitives

## Out of scope for this session

- Storybook / component catalog
- Visual regression tests
- Light mode
- Accessibility audit (WCAG pass-through; not a full audit)
- Animation polish beyond the basics in the mockup (fadeUp, pulse, waveform)
- Net-new product features

## Dependencies added

- Web: none (DM Sans via `next/font/google` is built-in)
- Mobile: `@expo-google-fonts/dm-sans` and `@expo-google-fonts/dm-mono` — or equivalent

All versions pinned in `package.json` exactly as Expo's SDK 54 compatibility table specifies. Confirmed no typosquatting risk (both packages are official Expo Google Fonts modules).
