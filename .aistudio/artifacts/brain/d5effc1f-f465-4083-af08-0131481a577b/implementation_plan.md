# Duelist Architect — Yu-Gi-Oh! Master Duel Deck Builder & Visual Studio

**Duelist Architect** is a full-stack Yu-Gi-Oh! Master Duel deck construction, validation, and customization platform that transforms natural-language strategy descriptions into tournament-legal 40–60 card Main Decks and 0–15 card Extra Decks backed by real card passcodes from the YGOPRODeck database. It features an interactive Master Duel import center (`.ydk` export, `ydke://` URI, Yu-Gi-Oh! Neuron bridge workflow, and in-game CP crafting checklist), a multi-persona Gemini tactical chatbot, and a high-resolution (1K / 2K / 4K) visual studio for custom sleeves, playmats, and card art.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product and architectural choices reflect your confirmed preferences from Phase 1 and establish the blueprint for implementation:

- **Confirmed Decision 1 — Deck Export & Master Duel Import Suite**: Full support for standard `.ydk` passcode file downloads, `ydke://` clipboard codes, and a step-by-step **Yu-Gi-Oh! Neuron → Master Duel** sync guide alongside an interactive in-game Search & Craft checklist (grouped by N / R / SR / UR rarity and Secret Packs).
- **Confirmed Decision 2 — Live YGOPRODeck Card Validation**: Every AI-recommended card is resolved against the live YGOPRODeck API (`db.ygoprodeck.com/api/v7/cardinfo.php`) to verify official 8-digit Konami passcodes, high-resolution card artwork, exact stats/effects, Master Duel rarity (N/R/SR/UR), and Master Duel banlist status (Forbidden / Limited / Semi-Limited / Unlimited).
- **Confirmed Decision 3 — Full Visual Studio (Sleeves, Mats & Card Art)**: Dedicated AI visual studio powered by `gemini-3-pro-image-preview` with user-selectable **1K, 2K, and 4K** output resolutions and preset aspect ratios tailored for **Card Sleeves (`3:4`)**, **Playmats (`16:9`)**, and **Custom Archetype / Boss Monster Art (`1:1`)**, with live preview right on the deck table.
- **Confirmed Decision 4 — Multi-Tier Gemini Duelist Coach**: Integrated multi-turn strategy chat supporting specialized coaching personas and dynamic model selection across **`gemini-4-argon`** (deep combo lines & meta matchup analysis), **`gemini-3.8-flash`** (general deck tuning & ratios), and **`gemini-3.1-flash-lite`** (instant rulings & quick hand-trap checks).

---

## 1. Overview & Core Concept

- **What It Does**: Users describe any playstyle, archetype, budget constraint, or combo idea in plain English (e.g., *"Competitive Fire King Snake-Eye deck resilient to Maxx 'C' with budget Extra Deck alternatives"*). The platform architects a structured Main Deck (40–60 cards), Extra Deck (0–15 cards), and optional Side/Tech pool, resolves every card against live YGOPRODeck data for exact passcodes and Master Duel legality, and lets users tweak ratios, test opening 5-card hands, consult an AI Duelist Coach, generate custom 1K/2K/4K accessories, and export directly into Yu-Gi-Oh! Master Duel.
- **Target Audience / Persona**: New, returning, and competitive *Yu-Gi-Oh! Master Duel* players who want to bridge the gap between a deck idea and an import-ready, banlist-verified list without manually hunting down 55 card passcodes or guessing UR crafting costs.
- **Key Value**: Combines LLM strategic synthesis with deterministic card database validation so generated `.ydk` files never contain hallucinated passcodes, while providing a visual step-by-step bridge into Master Duel via Yu-Gi-Oh! Neuron and in-game crafting checklists.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Prompt-to-Deck Construction Flow**:
   - The user enters a natural-language prompt (or picks a starter archetype template such as *Tenpai Dragon Going-Second*, *Branded Despia Midrange*, *Labrynth Control*, or *Budget Salamangreat*) and selects build preferences (Competitive Tier, Playstyle Focus, and UR Crafting Budget).
   - The backend calls Gemini (`gemini-4-argon` or `gemini-3.8-flash`) with structured JSON output to propose card names, quantities (1–3), and tactical roles (Starter, Extender, Hand Trap, Board Breaker, Boss, Engine), then resolves each card against the YGOPRODeck API to attach real Konami 8-digit passcodes, card art, Master Duel banlist limits, and CP rarity.
   - Any card exceeding Master Duel banlist limits is automatically clamped to legal copy counts so the resulting deck is immediately valid.

2. **Interactive Deck Workbench & Opening Hand Simulator**:
   - Users inspect the visual card grid split into **Main Deck (40–60)**, **Extra Deck (0–15)**, and **Tech / Side Options**.
   - Hovering or clicking any card opens the **Card Inspector Panel** with full pendulum/monster/spell/trap text, attribute/level/link arrows, Secret Pack source, Master Duel rarity (N/R/SR/UR), and `+1 / -1 / Remove` quantity controls.
   - A live **Card Database Search Drawer** queries YGOPRODeck by name, archetype, or type so users can manually add or swap cards.
   - A built-in **5-Card Test Hand Drawer** deals randomized opening hands with `"Draw +1 (Going Second)"` and `"Redraw Hand"` actions to test brick vs. starter consistency.

3. **Master Duel Import & Export Center**:
   - Clicking **Export & Import Guide** opens a dedicated workflow modal and workspace view providing:
     - **One-Click `.ydk` File Download**: Formatted strictly with `#created by Duelist Architect`, `#main`, `#extra`, and `!side` blocks containing official 8-digit Konami passcodes compatible with YGOPro, EDOPro, YGO Omega, DuelingBook, and Neuron browser importers.
     - **`ydke://` URL & Plain-Text Decklist Copy**: Instant clipboard export for sharing or pasting into third-party Master Duel transfer extensions.
     - **Step-by-Step Master Duel Import Guide**: Visual walkthrough covering **Method A (Official Yu-Gi-Oh! Neuron App / Konami Card Database Link Sync → "Copy Deck" in Master Duel)** and **Method B (In-Game Batch Search & Craft Workflow)** with an interactive checklist that tracks owned/crafted cards and calculates exact **N / R / SR / UR Crafting Points (CP)** required.

4. **Multi-Turn Gemini Duelist Coach (Chatbot)**:
   - Persistent slide-over or docked **Duelist Coach** thread that retains full multi-turn conversation history and knows the user's active Main and Extra Deck list in real time.
   - Users can switch between three specialized system personas:
     - **Combo & Line Strategist**: Breaks down 1-card and 2-card combo lines, choke points against *Ash Blossom* / *Infinite Impermanence*, and end-board setups.
     - **Meta & Banlist Analyst**: Evaluates matchups against current Master Duel ladder threats and suggests tech swaps.
     - **Budget & CP Optimizer**: Recommends N/R/SR replacements for expensive Ultra Rare (UR) cards while preserving engine synergy.
   - Users can switch the active Gemini model tier directly in the chat header:
     - **`gemini-4-argon`** (*Deep Tactical Reasoning* — complex combo trees & full deck restructuring)
     - **`gemini-3.8-flash`** (*Balanced Coaching* — general deck edits & synergy advice)
     - **`gemini-3.1-flash-lite`** (*Instant Ruling & Fast Check* — rapid card interactions & ratio checks)
   - When the coach suggests card additions or swaps, a `"Apply Suggested Changes to Deck"` action lets the user merge those changes into their active workbench.

5. **High-Resolution AI Visual Studio (Sleeves, Playmats & Card Art)**:
   - Dedicated **Visual Studio** workspace powered by `gemini-3-pro-image-preview`.
   - Users select an asset type (**Card Sleeve `3:4`**, **Duel Field Playmat `16:9`**, or **Custom Boss Monster / Archetype Art `1:1`**), choose the target resolution (**`1K`**, **`2K`**, or **`4K`**), and enter a visual prompt or auto-fill a prompt derived from their active deck's archetype.
   - Generated high-resolution artwork can be previewed directly on the interactive deck table (wrapping card backs in the custom sleeve or setting the playmat canvas background) and downloaded as a crisp PNG.

### Visual Identity & Theme

- **Aesthetic Direction**: **Tactical Duelist Atelier** — inspired by *Yu-Gi-Oh! Master Duel*'s dark obsidian-and-gold tournament interface paired with the clean analytical precision of modern competitive deck-building tools.
- **Color Palette & Mood (60-30-10 Discipline)**:
  - **60% Dominant Neutral Canvas (`--background`)**: Deep obsidian slate (`#0B0F17`) and rich tournament navy-charcoal (`#111827`) providing high-contrast framing for colorful Yu-Gi-Oh! card frames (Normal Yellow, Effect Orange, Ritual Blue, Fusion Violet, Synchro White, Xyz Black, Link Dark Blue, Spell Teal, Trap Magenta).
  - **30% Structural Surfaces (`--surface`)**: Elevated slate panels (`#161F30`) with crisp `1px solid rgba(255, 255, 255, 0.08)` hairline borders and muted cool-gray metadata (`#94A3B8`).
  - **10% Focal Accent Budget (`--accent`)**: Millennium Gold (`#F59E0B`) for primary CTAs and active states, paired with semantic status indicators always accompanied by explicit text labels (`Legal · Unlimited`, `Limited · 1 Max`, `Semi-Limited · 2 Max`, `Forbidden · 0`).
- **Typography & Hierarchy (2+1 Font Rule)**:
  - *Display / Headers*: **`Cinzel`** (for refined tournament headers and archetype titles) paired with **`Plus Jakarta Sans`** for crisp UI controls and section headings.
  - *Body Prose*: **`Plus Jakarta Sans`** for clean readability across long monster card effect boxes and combo guides.
  - *Numeric & Telemetry (`tabular-nums`)*: **`JetBrains Mono`** (`font-mono tabular-nums`) strictly applied to 8-digit card passcodes, ATK/DEF stats, deck counts (`40 / 60`), Crafting Point totals (`780 UR CP`), and hand probability percentages.
- **Component Styling & Layout**:
  - **Top Bar Contract**: Strict 3-zone header separated by `gap-8`:
    1. Single-line Brand Wordmark (`Duelist Architect`) on the left.
    2. 4 concise single-line navigation links (`Deck Builder`, `Import Guide`, `Visual Studio`, `Card Database`) in the center.
    3. 1 primary action button (`Export .YDK Deck`) on the right.
  - **Zero-Pill Metadata Discipline**: Card metadata (`DARK · Dragon / Synchro / Effect · Lv 10 · ATK 3000 / DEF 2500 · Passcode 84815190`) is rendered as clean, unboxed inline text with `·` separators rather than cluttered badge sandwiches.
  - **1440px Desktop Workspace**: Full-width 12-column tactical workspace with a left/center visual card workbench and a right-hand inspector / AI Coach / Card Search dock.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Two-Stage AI + Live YGOPRODeck Resolution Pipeline**
  - *Chosen Approach*: Gemini generates structured card names, copy counts, and strategic roles; the Express server immediately resolves and hydrates those cards via `db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes` (with fuzzy fallback search and in-memory caching).
  - *Why*: LLMs excel at Yu-Gi-Oh! archetype synergy and combo theory but frequently hallucinate 8-digit Konami passcodes. Resolving against YGOPRODeck guarantees 100% authentic `.ydk` passcodes, official card artwork, and accurate Master Duel banlist & rarity metadata.
  - *Alternatives Considered*: Pure LLM passcode generation (rejected due to invalid `.ydk` imports) or bundling a static 13,000-card JSON file in the frontend bundle (rejected due to bundle bloat).

- **Decision 2: Multi-Method Master Duel Import Bridge**
  - *Chosen Approach*: Provide direct `.ydk` file download, `ydke://` URI copy, Konami Card Database / Yu-Gi-Oh! Neuron import format, and an interactive in-game Crafting & Search checklist.
  - *Why*: *Yu-Gi-Oh! Master Duel* does not natively open `.ydk` files directly from the OS file picker without syncing through Konami's official **Yu-Gi-Oh! Neuron** app (linked via Konami ID) or using a browser transfer extension. Explaining and supporting both the official Neuron sync route and the in-game batch search checklist ensures every player—on PC, console, or mobile—can get their deck into the game effortlessly.

- **Decision 3: Multi-Model Gemini Routing & Server-Side Proxy**
  - *Chosen Approach*: All `@google/genai` SDK calls run exclusively on the Express backend (`/api/gemini/*`) with `User-Agent: 'aistudio-build'`. Users can select `gemini-4-argon`, `gemini-3.8-flash`, or `gemini-3.1-flash-lite` in the multi-turn chatbot, while the Visual Studio uses `gemini-3-pro-image-preview` with `1K`, `2K`, and `4K` resolution options.
  - *Why*: Keeps API keys strictly server-side while giving users the exact speed-vs-depth trade-off needed during deckbuilding.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                         TOP BAR (3-Zone Contract)                                 │
│  [Duelist Architect]     [Deck Builder · Import Guide · Visual Studio · Database] │
│                                                                [Export .YDK Deck] │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                 ▼
┌───────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
│  DECK WORKBENCH VIEW  │     │  MASTER DUEL IMPORT   │     │   AI VISUAL STUDIO    │
│  ├─ AI Prompt Bar     │     │  & EXPORT CENTER      │     │   ├─ Asset Selector   │
│  ├─ Main Deck (40-60) │     │  ├─ .YDK File Builder │     │   │  (Sleeve/Mat/Art) │
│  ├─ Extra Deck (0-15) │     │  ├─ YDKe:// URI Gen   │     │   ├─ Size: 1K|2K|4K   │
│  ├─ 5-Card Hand Test  │     │  ├─ Neuron Sync Guide │     │   ├─ Table Preview    │
│  └─ Card Inspector    │     │  └─ CP Craft Checklist│     │   └─ Gallery & Export │
└───────────┬───────────┘     └───────────┬───────────┘     └───────────┬───────────┘
            │                             │                             │
            └─────────────────────────────┼─────────────────────────────┘
                                          │
                         ┌────────────────▼────────────────┐
                         │  PERSISTENT DUELIST COACH DOCK  │
                         │  ├─ Multi-Turn Scrollable Chat  │
                         │  ├─ Role Persona Switcher       │
                         │  ├─ Model: Argon | Flash | Lite │
                         │  └─ One-Click Apply Deck Edits  │
                         └────────────────┬────────────────┘
                                          │ HTTP JSON (/api/*)
┌─────────────────────────────────────────▼─────────────────────────────────────────┐
│                         EXPRESS BACKEND SERVER (server.ts)                        │
│  ├─ POST /api/deck/generate  ──► Gemini Structured Deck JSON + YGOPRODeck Hydrate │
│  ├─ GET  /api/cards/search   ──► Live YGOPRODeck API Proxy + In-Memory Cache      │
│  ├─ POST /api/chat/message   ──► Multi-Turn Chat (gemini-4-argon / 3.8 / 3.1)    │
│  └─ POST /api/image/generate ──► gemini-3-pro-image-preview (1K / 2K / 4K)        │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **`YgoCard`**:
  - `id` (number — official 8-digit Konami passcode used in `.ydk` files)
  - `name` (string), `type` (string — e.g., `"Effect Monster"`, `"Synchro Monster"`, `"Quick-Play Spell Card"`)
  - `frameType` (`"normal" | "effect" | "ritual" | "fusion" | "synchro" | "xyz" | "link" | "pendulum" | "spell" | "trap"`)
  - `desc` (string), `atk` (number | undefined), `def` (number | undefined), `level` (number | undefined), `race` (string), `attribute` (string | undefined)
  - `imageUrl` (string), `imageUrlSmall` (string)
  - `mdRarity` (`"N" | "R" | "SR" | "UR"`), `banlistStatus` (`"Unlimited" | "Semi-Limited" | "Limited" | "Forbidden"`)
  - `role` (`"Starter" | "Extender" | "Hand Trap" | "Board Breaker" | "Boss" | "Engine" | "Tech"`)
- **`DeckEntry`**:
  - `card: YgoCard`, `quantity: 1 | 2 | 3`, `section: "main" | "extra" | "side"`, `reason?: string`
- **`DeckState`**:
  - `name: string`, `archetype: string`, `strategySummary: string`, `comboGuide: string[]`
  - `entries: DeckEntry[]`
  - `customSleeveUrl?: string`, `customPlaymatUrl?: string`
- **`ChatMessage`**:
  - `id: string`, `role: "user" | "model"`, `content: string`, `timestamp: string`, `modelUsed: string`, `persona: string`, `suggestedChanges?: { action: "add" | "remove"; cardName: string; quantity: number; section: "main" | "extra" | "side" }[]`
- **`GeneratedVisualAsset`**:
  - `id: string`, `type: "sleeve" | "playmat" | "card_art"`, `prompt: string`, `imageSize: "1K" | "2K" | "4K"`, `aspectRatio: "3:4" | "16:9" | "1:1"`, `imageUrl: string`, `createdAt: string`

### Interactive Component & State Mapping

- **AI Deck Constructor Bar**: Submitting a description triggers `/api/deck/generate`, displays a phase-based progress state (*Synthesizing Archetype Engine → Resolving Konami Passcodes & Master Duel Banlist → Calculating UR/SR Crafting Costs*), and populates `DeckState` (with a pre-loaded tournament-ready *Fire King Snake-Eye* or *Blue-Eyes Bystial* starter deck available immediately on zero-state load).
- **Deck Grid & Card Inspector**: Clicking any card selects it in the Inspector; clicking `+` / `-` mutates `DeckEntry.quantity` while enforcing the 3-copy rule and the card's Master Duel banlist limit (`Forbidden = 0`, `Limited = 1`, `Semi-Limited = 2`).
- **YDK & YDKe Generator**:
  - `.ydk` serializer outputs `#created by Duelist Architect\n#main\n...passcodes...\n#extra\n...passcodes...\n!side\n...passcodes...` and triggers a browser file download (`<deck-slug>.ydk`).
  - `ydke://` serializer packs 32-bit unsigned little-endian integers for Main, Extra, and Side passcodes into base64 segments (`ydke://<main>!<extra>!<side>!`).
- **Multi-Turn Gemini Coach**: Sends full `history: { role, parts }[]`, active `persona`, selected `model` (`gemini-4-argon`, `gemini-3.8-flash`, or `gemini-3.1-flash-lite`), and serialized `currentDeck` context to `/api/chat/message`. If the response includes structured deck edit suggestions, the user can click `"Apply Changes"` to automatically resolve and update `DeckState`.
- **Visual Studio (`gemini-3-pro-image-preview`)**: User picks `imageSize` (`1K`, `2K`, or `4K`) and asset category (`sleeve`, `playmat`, or `card_art`), calls `/api/image/generate`, and can click `"Apply to Deck Table"` to immediately skin the workbench playmat or card sleeves.
