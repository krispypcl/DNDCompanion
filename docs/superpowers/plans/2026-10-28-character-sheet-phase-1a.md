# Character Sheet — Phase 1a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed, usable online character sheet — sign in, create a sheet, edit it in place, and track HP, resources and rests during a session.

**Architecture:** SvelteKit compiled to static files on GitHub Pages. The browser renders and computes everything; Supabase stores data, authenticates users and enforces permissions through row-level security. Derived values (modifiers, saves, skill totals, tracker maxima) are computed at render time from pure functions, never stored.

**Tech Stack:** SvelteKit (`@sveltejs/adapter-static`), Vite, TypeScript, Vitest, `@supabase/supabase-js`, Postgres via Supabase.

**Spec:** `docs/superpowers/specs/2026-10-28-character-sheet-design.md` (revision 2)

## Global Constraints

- Static output only. No server-side code, no SvelteKit server routes, no `+page.server.ts`.
- Derived values are never persisted. Modifiers, save bonuses, skill totals, passive scores, spell save DCs and tracker maxima are computed at render.
- `definition` and `state` are written independently. A state write never touches definition.
- Authorization lives in Postgres RLS, never in the client. Client-side checks are for UI only.
- `prefers-reduced-motion` disables all transitions.
- Phone and laptop are equal targets. No layout below 360px wide may scroll horizontally.
- Supabase anon key is public and committed; the service role key is never used in this project.
- Ability identifiers in formulas resolve to **modifiers**, not scores.
- Division in formulas floors.

## Review Focus

Five conditions the spec implies that no task's happy-path tests cover. Each has a test added to the task that owns the code.

1. **HP below zero or above max** — damage past 0 clamps to 0, healing past max clamps to max, temp HP absorbs damage before current HP. (Task 9)
2. **A formula's result shrinking below spent count** — level drops or an ability is lowered, so a tracker's max falls under what is already spent; the tracker must clamp rather than render negative pips. (Task 10)
3. **Names needing URL encoding** — `Mordenkainen's Faithful Hound`, `Melf's Acid Arrow`, `Tiefling (Glasya)`. Apostrophes and parentheses must survive correctly. (Task 5)
4. **A stale second tab overwriting newer data** — two tabs open, one edits, the other autosaves its older copy. The write must carry `updated_at` and refuse if the row moved. (Task 7)
5. **Unbounded free text** — a 20,000-character backstory or feature body must not break layout or block the save. (Task 15)

---

## File Structure

```
src/lib/
  supabase.ts              Supabase client singleton
  types.ts                 Definition, State, Tracker, Sheet, Ability
  rules/
    formula.ts             tracker formula parser + evaluator
    derived.ts             modifiers, saves, skills, passives, DCs
    lookup.ts              5e.tools URL builder
  data/
    sheets.ts              sheet CRUD
    session.ts             auth calls
  stores/
    session.ts             current user store
    sheet.ts               current sheet + autosave
    undo.ts                snapshot stack
  components/
    VitalsStrip.svelte     HP, temp HP, AC, death saves
    Tracker.svelte         one tracker: pips / counter / gauge
    TrackerGroup.svelte    grouped trackers
    RestButtons.svelte     short / long rest
    Tabs.svelte            tab shell
    AbilityBlock.svelte    six scores + modifiers + saves
    SkillList.svelte       skills with totals
    AttackList.svelte      attacks
    SpellTable.svelte      spell rows
    EntryLink.svelte       5e.tools icon / Homebrew tag
    SaveIndicator.svelte   saved / saving / unsaved
    UndoToast.svelte       transient undo prompt
    EditableField.svelte   in-place editing primitive
src/routes/
  +layout.svelte
  +page.svelte             your sheets, or sign in
  s/[id]/+page.svelte      the sheet
  login/+page.svelte
  signup/+page.svelte
  reset/+page.svelte
supabase/migrations/
  0001_init.sql            all three tables + RLS
tests/
  rules/                   unit tests for pure modules
  policies/                RLS integration tests
```

---

### Task 1: Project scaffolding and deployment

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`
- Create: `src/routes/+layout.svelte`, `src/routes/+page.svelte`
- Create: `.github/workflows/deploy.yml`
- Create: `.env.example`, `README.md`
- Create: `docs/superpowers/specs/2026-10-28-character-sheet-design.md` (copy the approved spec in)

**Interfaces:**
- Produces: a building SvelteKit project with `npm test` wired to Vitest, deployed to GitHub Pages on push to `main`.

- [ ] **Step 1: Scaffold the project**

`npm create svelte@latest` — skeleton, TypeScript, Vitest. Install `@sveltejs/adapter-static` and `@supabase/supabase-js`.

- [ ] **Step 2: Configure static output**

In `svelte.config.js`, use `adapter-static` with `fallback: 'index.html'` (the app has dynamic routes under `/s/[id]`). Set `paths.base` from `process.env.BASE_PATH` so Pages' subpath works.

- [ ] **Step 3: Verify the build produces static files**

Run: `npm run build`
Expected: `build/index.html` exists, no server bundle emitted.

- [ ] **Step 4: Add the Pages workflow**

`.github/workflows/deploy.yml` — on push to `main`: checkout, setup-node, `npm ci`, `npm run build` with `BASE_PATH` set to the repo name, `actions/upload-pages-artifact`, `actions/deploy-pages`.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: scaffold SvelteKit static project with Pages deploy"
```

---

### Task 2: Database schema and policies

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Test: `tests/policies/rls.test.ts`

**Interfaces:**
- Produces: tables `campaigns`, `sheets`, `entries` with RLS enabled. Phase 1a uses only `sheets`; the other two ship now so no migration is needed later.

- [ ] **Step 1: Write the failing policy tests**

Against a local Supabase instance, using two test users and one anonymous client:

```ts
test('anonymous can read any sheet')
test('anonymous cannot insert a sheet')
test('owner can update own sheet')
test('non-owner cannot update another sheet')
test('non-owner cannot delete another sheet')
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test tests/policies/rls.test.ts`
Expected: FAIL — relation "sheets" does not exist.

- [ ] **Step 3: Write the migration**

The three `create table` statements and the twelve policies exactly as written in the spec's *Auth and permissions* section. Add `updated_at` triggers on `sheets` and `entries`.

- [ ] **Step 4: Apply and verify**

Run: `supabase db reset && npm test tests/policies/rls.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/ tests/policies/
git commit -m "feat: add schema and row-level security policies"
```

---

### Task 3: Formula parser

**Files:**
- Create: `src/lib/rules/formula.ts`
- Test: `tests/rules/formula.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type FormulaContext = { level: number; prof: number;
    str: number; dex: number; con: number; int: number; wis: number; cha: number }
  function evaluateFormula(expr: string | number, ctx: FormulaContext): number
  class FormulaError extends Error {}
  ```
  Ability values in `ctx` are **modifiers**. `evaluateFormula` throws `FormulaError` on malformed input.

- [ ] **Step 1: Write the failing tests**

```ts
test('a plain number passes through')            // 4 → 4
test('a numeric string parses')                  // "4" → 4
test('level resolves')                           // "level", level 5 → 5
test('prof resolves')                            // "prof", prof 3 → 3
test('an ability resolves to its modifier')      // "cha", cha 4 → 4
test('addition')                                 // "prof+1", prof 3 → 4
test('subtraction')                              // "level-1", level 5 → 4
test('division floors')                          // "level/2", level 5 → 2
test('left-to-right with precedence')            // "level/2+1", level 5 → 3
test('unknown identifier throws FormulaError')   // "wisdom"
test('malformed input throws FormulaError')      // "level +", "", "2++2"
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test tests/rules/formula.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the parser**

Recursive descent over the grammar in the spec. Tokenise, then `expr := term (('+'|'-') term)*`, `term := factor ('/' factor)*`, `factor := integer | identifier`. Division uses `Math.floor`. **Never `eval`.**

- [ ] **Step 4: Run to verify they pass**

Run: `npm test tests/rules/formula.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/rules/formula.ts tests/rules/formula.test.ts
git commit -m "feat: add tracker formula parser"
```

---

### Task 4: Derived values

**Files:**
- Create: `src/lib/rules/derived.ts`, `src/lib/types.ts`
- Test: `tests/rules/derived.test.ts`

**Interfaces:**
- Produces:
  ```ts
  function abilityModifier(score: number): number
  function saveBonus(def: Definition, ability: Ability): number
  function skillTotal(def: Definition, skill: SkillName): number
  function passiveScore(def: Definition, skill: SkillName): number
  function spellSaveDC(def: Definition, ability: Ability): number
  function spellAttackBonus(def: Definition, ability: Ability): number
  ```

- [ ] **Step 1: Write the failing tests**

Use Loka's real numbers from the spec's source sheet as fixtures — DEX 18, CHA 18, INT 9, proficiency 3.

```ts
test('modifier from score')                 // 18 → +4, 9 → −1, 1 → −5, 30 → +10
test('proficient save adds proficiency')    // DEX save → +7
test('non-proficient save is the modifier') // CON 16 → +3
test('proficient skill adds proficiency')   // Stealth → +7
test('expertise doubles proficiency')       // → +10
test('non-proficient skill is the modifier')// Perception, not prof → +2
test('passive is 10 plus the total')        // Perception → 12
test('spell save DC is 8 + prof + mod')     // CHA → 15
test('spell attack is prof + mod')          // CHA → +7
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test tests/rules/derived.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

`abilityModifier` is `Math.floor((score - 10) / 2)`. The rest read `definition.proficiency` and the skill/save proficiency flags.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test tests/rules/derived.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/rules/derived.ts src/lib/types.ts tests/rules/derived.test.ts
git commit -m "feat: add derived value calculations"
```

---

### Task 5: 5e.tools link builder

**Files:**
- Create: `src/lib/rules/lookup.ts`
- Test: `tests/rules/lookup.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type LookupCategory = 'spells'|'items'|'races'|'feats'|'backgrounds'|'classes'|'conditionsdiseases'
  function lookupUrl(name: string, source: string | undefined,
                     category: LookupCategory, override?: string): string | null
  ```
  Returns `override` when present. Returns `null` when `source` is absent or `'homebrew'`.

- [ ] **Step 1: Write the failing tests**

Assert against the eight real URLs collected during design:

```ts
test('spell')       // Command / xphb → 'https://5e.tools/spells.html#command_xphb'
test('item')        // Revolver / valdagunslinger → '...items.html#revolver_valdagunslinger'
test('race with parentheses')
                    // Tiefling (Glasya) / mtf → '...races.html#tiefling%20(glasya)_mtf'
test('feat')        // Archery / xphb → '...feats.html#archery_xphb'
test('background')  // Artisan / xphb → '...backgrounds.html#artisan_xphb'
test('apostrophe survives')
                    // Melf's Acid Arrow / xphb → "...spells.html#melf's%20acid%20arrow_xphb"
test('override wins over name and source')
test('homebrew source returns null')
test('missing source returns null')
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test tests/rules/lookup.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

`https://5e.tools/${category}.html#${encodeURIComponent(name.toLowerCase())}_${source}`. `encodeURIComponent` already leaves `(`, `)` and `'` unescaped, which matches 5e.tools' own format.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test tests/rules/lookup.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/rules/lookup.ts tests/rules/lookup.test.ts
git commit -m "feat: add 5e.tools link builder"
```

---

### Task 6: Supabase client and auth

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/data/session.ts`, `src/lib/stores/session.ts`
- Create: `src/routes/login/+page.svelte`, `src/routes/signup/+page.svelte`, `src/routes/reset/+page.svelte`

**Interfaces:**
- Produces:
  ```ts
  // data/session.ts
  function signUp(email: string, password: string): Promise<void>
  function signIn(email: string, password: string): Promise<void>
  function signOut(): Promise<void>
  function requestReset(email: string): Promise<void>
  // stores/session.ts
  const session: Readable<{ user: User | null; loading: boolean }>
  ```

- [ ] **Step 1: Create the client**

`src/lib/supabase.ts` exports a singleton from `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`, with `persistSession: true`.

- [ ] **Step 2: Implement the auth calls**

Thin wrappers over `supabase.auth`. Sign-up requires email confirmation — enable it in the Supabase project and say so in the README.

- [ ] **Step 3: Build the session store**

Initialise from `getSession()`, then subscribe to `onAuthStateChange`.

- [ ] **Step 4: Build the three auth pages**

Each: a form, inline error display, a link to the others. Errors show the Supabase message, never a generic failure.

- [ ] **Step 5: Verify manually**

Sign up, confirm by email, sign out, sign in, request a reset. Expected: all five complete.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.ts src/lib/data/session.ts src/lib/stores/session.ts src/routes/login src/routes/signup src/routes/reset
git commit -m "feat: add Supabase client and auth flows"
```

---

### Task 7: Sheet data layer and autosave

**Files:**
- Create: `src/lib/data/sheets.ts`, `src/lib/stores/sheet.ts`, `src/lib/components/SaveIndicator.svelte`
- Test: `tests/data/sheets.test.ts`

**Interfaces:**
- Consumes: `supabase` from Task 6.
- Produces:
  ```ts
  function loadSheet(id: string): Promise<Sheet | null>
  function listMySheets(): Promise<Sheet[]>
  function createSheet(name: string): Promise<Sheet>
  function saveDefinition(id: string, def: Definition, expectedUpdatedAt: string): Promise<string>
  function saveState(id: string, state: State, expectedUpdatedAt: string): Promise<string>
  // both resolve the new updated_at, or reject with StaleWriteError
  type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'stale'
  ```

- [ ] **Step 1: Write the failing tests**

```ts
test('saveState writes state and leaves definition untouched')
test('saveDefinition writes definition and leaves state untouched')
test('a save with a stale updated_at rejects with StaleWriteError')   // Review Focus 4
test('loadSheet returns null for an unknown id')
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test tests/data/sheets.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the data layer**

Each save is an `update ... where id = $1 and updated_at = $2`. A zero-row result means the row moved — throw `StaleWriteError`.

- [ ] **Step 4: Implement the store and indicator**

`stores/sheet.ts` holds the loaded sheet and a `SaveStatus`. Writes debounce 500ms and retry twice on network failure. On `StaleWriteError` the status becomes `stale` and the UI prompts to reload — it does not silently overwrite.

- [ ] **Step 5: Run to verify they pass**

Run: `npm test tests/data/sheets.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/sheets.ts src/lib/stores/sheet.ts src/lib/components/SaveIndicator.svelte tests/data/
git commit -m "feat: add sheet data layer with optimistic-concurrency saves"
```

---

### Task 8: Undo stack

**Files:**
- Create: `src/lib/stores/undo.ts`, `src/lib/components/UndoToast.svelte`
- Test: `tests/stores/undo.test.ts`

**Interfaces:**
- Produces:
  ```ts
  function snapshot(state: State, label: string): void
  function undo(): { state: State; label: string } | null
  const canUndo: Readable<boolean>
  const lastLabel: Readable<string | null>
  ```

- [ ] **Step 1: Write the failing tests**

```ts
test('undo returns the previous state')
test('undo returns null when the stack is empty')
test('the stack holds at most ten entries')
test('the eleventh snapshot evicts the oldest')
test('undo returns the label it was snapshotted with')
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test tests/stores/undo.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

A bounded array of deep-cloned states with labels. Session-local — not persisted.

- [ ] **Step 4: Build the toast**

Appears on snapshot with a label, auto-dismisses after 10s, offers Undo.

- [ ] **Step 5: Run to verify they pass**

Run: `npm test tests/stores/undo.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/stores/undo.ts src/lib/components/UndoToast.svelte tests/stores/
git commit -m "feat: add undo stack and toast"
```

---

### Task 9: Vitals strip

**Files:**
- Create: `src/lib/components/VitalsStrip.svelte`
- Test: `tests/components/vitals.test.ts`

**Interfaces:**
- Consumes: `sheet` store (Task 7), `snapshot` (Task 8).
- Produces: `function applyDamage(state: State, amount: number, hpMax: number): State` and `applyHealing`, exported from the component module for testing.

- [ ] **Step 1: Write the failing tests** *(Review Focus 1)*

```ts
test('damage reduces current HP')
test('damage below zero clamps to zero')
test('temp HP absorbs damage first')
test('damage exceeding temp HP spills into current HP')
test('healing above max clamps to max')
test('healing from zero works')
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test tests/components/vitals.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the functions and the component**

Sticky strip showing current HP, temp HP, AC, and death-save pips when `hpCurrent === 0`. HP animates by counting; the bar drains behind it. Damage and healing call `snapshot` first.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test tests/components/vitals.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/VitalsStrip.svelte tests/components/vitals.test.ts
git commit -m "feat: add vitals strip with HP clamping"
```

---

### Task 10: Tracker component

**Files:**
- Create: `src/lib/components/Tracker.svelte`, `src/lib/components/TrackerGroup.svelte`
- Test: `tests/components/tracker.test.ts`

**Interfaces:**
- Consumes: `evaluateFormula` (Task 3).
- Produces: `function trackerMax(t: Tracker, ctx: FormulaContext): number` and `function clampSpent(spent: number, max: number): number`, exported for testing.

- [ ] **Step 1: Write the failing tests** *(Review Focus 2)*

```ts
test('a numeric max passes through')
test('a formula max evaluates')                  // "level", level 5 → 5
test('spent is clamped when max shrinks')        // spent 4, max falls to 2 → 2
test('spent never goes negative')
test('an invalid formula surfaces an error state, not zero')
test('accrue direction starts empty')
test('spend direction starts full')
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test tests/components/tracker.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

Three renderings driven by `type`: `pips` (tappable circles, die label when `die` is set), `counter` (number with +/−), `gauge` (a bar). `direction` decides whether taps fill or empty. Pips fill with a spring transition. `TrackerGroup` renders trackers sharing a `group` as one block.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test tests/components/tracker.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Tracker.svelte src/lib/components/TrackerGroup.svelte tests/components/tracker.test.ts
git commit -m "feat: add tracker component with formula maxima"
```

---

### Task 11: Rest actions

**Files:**
- Create: `src/lib/components/RestButtons.svelte`
- Create: `src/lib/rules/rest.ts`
- Test: `tests/rules/rest.test.ts`

**Interfaces:**
- Consumes: `evaluateFormula` (Task 3), `snapshot` (Task 8).
- Produces: `function applyRest(def: Definition, state: State, kind: 'short'|'long'|'dawn'): State`

- [ ] **Step 1: Write the failing tests**

```ts
test('short rest refills only trackers with reset.on === "short"')
test('long rest refills short, long and dawn trackers')
test('dawn refills only dawn trackers')
test('a partial reset amount restores that many, not all')
test('a formula reset amount evaluates')          // "level/2"
test('a partial reset never exceeds max')
test('long rest restores HP to max')
test('long rest clears temp HP')
test('manual trackers are never touched by any rest')
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test tests/rules/rest.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `applyRest` and the buttons**

Pure function over state. The component snapshots for undo, applies, and triggers the staggered refill animation — the one orchestrated moment in the app.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test tests/rules/rest.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/rules/rest.ts src/lib/components/RestButtons.svelte tests/rules/rest.test.ts
git commit -m "feat: add short and long rest"
```

---

### Task 12: Tab shell and Character tab

**Files:**
- Create: `src/lib/components/Tabs.svelte`, `AbilityBlock.svelte`, `SkillList.svelte`
- Create: `src/routes/s/[id]/+page.svelte`

**Interfaces:**
- Consumes: `derived.ts` (Task 4), `sheet` store (Task 7), `VitalsStrip` (Task 9).

- [ ] **Step 1: Build the tab shell**

Four tabs for 1a — Play, Character, Spells, Notes. The Library tab arrives in phase 1b. Crossfade between panels; deep-link the active tab via `location.hash`.

- [ ] **Step 2: Build the sheet route**

Load by `params.id`. Render the vitals strip and tabs. Unknown id renders a plain empty state, not an error.

- [ ] **Step 3: Build AbilityBlock and SkillList**

Every number read from `derived.ts`. Nothing computed is stored or duplicated.

- [ ] **Step 4: Verify manually**

Load a sheet seeded with Loka's values. Expected: DEX save +7, Stealth +7, passive Perception 12, spell save DC 15.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Tabs.svelte src/lib/components/AbilityBlock.svelte src/lib/components/SkillList.svelte src/routes/s/
git commit -m "feat: add sheet route, tabs and character tab"
```

---

### Task 13: Play tab

**Files:**
- Create: `src/lib/components/AttackList.svelte`
- Modify: `src/routes/s/[id]/+page.svelte`

**Interfaces:**
- Consumes: `Tracker`, `TrackerGroup` (Task 10), `RestButtons` (Task 11), `UndoToast` (Task 8).

- [ ] **Step 1: Assemble the Play tab**

Trackers grouped, rest buttons, attack list, conditions, the persistent undo control.

- [ ] **Step 2: Build AttackList**

Name, to-hit, damage, notes. Each row carries an `EntryLink` slot (filled in Task 14).

- [ ] **Step 3: Verify manually**

Spend a Risk Die, short rest, confirm it refills and the undo toast reverses it.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/AttackList.svelte src/routes/s/
git commit -m "feat: add play tab"
```

---

### Task 14: Spells tab and entry links

**Files:**
- Create: `src/lib/components/SpellTable.svelte`, `src/lib/components/EntryLink.svelte`
- Modify: `AttackList.svelte`, `src/routes/s/[id]/+page.svelte`

**Interfaces:**
- Consumes: `lookupUrl` (Task 5).

- [ ] **Step 1: Build EntryLink**

Given a name, source, category and optional override: renders a small link icon when `lookupUrl` returns a URL, a **Homebrew** tag when the source is `homebrew`, and nothing otherwise. Hidden until hover on pointer devices, faintly visible on touch. Opens in a new tab.

- [ ] **Step 2: Build SpellTable**

Columns per the spec: name, save, time, range, components, duration, notes. Horizontally scrollable in its own container on narrow screens — the page body never scrolls sideways.

- [ ] **Step 3: Wire EntryLink into spells, attacks, features and equipment**

- [ ] **Step 4: Verify manually**

A spell with `source: xphb` opens the right 5e.tools page; one with `source: homebrew` shows the tag and no icon.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/SpellTable.svelte src/lib/components/EntryLink.svelte src/lib/components/AttackList.svelte src/routes/s/
git commit -m "feat: add spells tab and 5e.tools entry links"
```

---

### Task 15: Notes tab

**Files:**
- Create: `src/lib/components/EquipmentList.svelte`
- Modify: `src/routes/s/[id]/+page.svelte`
- Test: `tests/components/notes.test.ts`

- [ ] **Step 1: Write the failing test** *(Review Focus 5)*

```ts
test('a 20,000-character notes field renders without breaking layout')
test('a very long single word wraps rather than overflowing')
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test tests/components/notes.test.ts`
Expected: FAIL

- [ ] **Step 3: Build the tab**

Equipment, currency, free-text notes. Long text uses `overflow-wrap: anywhere` and a scrolling container.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test tests/components/notes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/EquipmentList.svelte src/routes/s/ tests/components/notes.test.ts
git commit -m "feat: add notes tab"
```

---

### Task 16: In-place editing

**Files:**
- Create: `src/lib/components/EditableField.svelte`
- Modify: every component rendering a `definition` value

**Interfaces:**
- Consumes: `session` store (Task 6), `sheet` store (Task 7).

- [ ] **Step 1: Build EditableField**

A primitive taking a value, a type (`text` | `number` | `textarea` | `toggle`) and a change handler. Renders plain text when not editing, an input when editing. Never reflows the layout between the two states.

- [ ] **Step 2: Add the edit toggle**

Visible only when `session.user.id === sheet.owner_id`. Toggling enables every `EditableField` at once.

- [ ] **Step 3: Wire definition fields through it**

Identity, abilities, proficiency, combat, skill proficiencies, attacks, features, spells, trackers, equipment, currency, notes.

- [ ] **Step 4: Verify manually**

As owner: edit, confirm autosave fires and the indicator settles on *saved*. Signed out: no edit controls, and a direct `saveDefinition` call is rejected by RLS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/EditableField.svelte src/lib/components src/routes/s/
git commit -m "feat: add in-place editing for sheet owners"
```

---

### Task 17: Home page

**Files:**
- Modify: `src/routes/+page.svelte`

**Interfaces:**
- Consumes: `listMySheets`, `createSheet` (Task 7), `session` store (Task 6).

- [ ] **Step 1: Build the signed-out view**

A short explanation and links to sign in or sign up.

- [ ] **Step 2: Build the signed-in view**

Your sheets as cards — name, class, level — plus **New sheet**, which creates an empty sheet and navigates to it in edit mode.

- [ ] **Step 3: Verify manually**

Create a sheet, fill it with Loka's values, reload, confirm everything persists. Open the URL in a private window and confirm it renders read-only.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: add home page with sheet list"
```

---

## Done when

- The app is live on GitHub Pages
- A user can sign up, confirm by email, sign in, and create a sheet
- The sheet holds Loka's real values and every derived number is correct
- Risk Dice spend and refill on a short rest, with undo
- Anonymous visitors see the sheet read-only
- `npm test` passes
