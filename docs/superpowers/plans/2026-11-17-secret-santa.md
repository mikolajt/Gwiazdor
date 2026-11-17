# Secret Santa ("Gwiazdor") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static Secret Santa site: an admin panel that runs the draw and produces one private link per person, and a playful "unwrap the present" page that reveals the assignment from the link.

**Architecture:** Two HTML pages plus shared plain JavaScript, no build step, hosted on GitHub Pages from a public repo. Each person's assignment travels in the URL fragment as XOR-scrambled base64url JSON, so nothing secret is ever stored in the repo. The admin panel keeps its state in `localStorage`.

**Tech Stack:** HTML, CSS, vanilla JavaScript (classic `<script>` tags, not ES modules — modules fail over `file://`), Google Fonts (Nunito), in-browser test page. No Node, no frameworks.

**Spec:** `docs/superpowers/specs/2026-11-17-secret-santa-design.md`

## Global Constraints

- All user-facing text in Polish.
- Never use the word "Mikołaj" for the Santa role; use "Gwiazdor".
- Names are always shown exactly as typed (trimmed), never inflected; copy must be gender-neutral.
- Reveal copy: greeting `Cześć, {g}! 🎄`; hint `Twoja osoba jest w środku… Stuknij prezent!`; label `Twoja osoba to:`; preferences heading `Lista życzeń:`; budget line `Budżet: {b}`.
- Bad link copy: `Ten link nie działa. Poproś organizatora o nowy.`
- Page `<title>` and `og:title` on `index.html`: `Gwiazdor 🎁 — Twoje losowanie`; nothing participant-specific in any meta tag.
- At least 3 participants; names unique (case-insensitive, trimmed).
- Only rule for the draw: nobody draws themselves. Sub-cycles allowed.
- User text is always inserted with `textContent`, never `innerHTML`.
- Fonts must support Polish characters: use Nunito; do not use Mountains of Christmas.
- No file in the repo may contain participant data. `.superpowers/` is git-ignored.
- Visual reference for the reveal page: `.superpowers/mockups/page-styles.html`, option B.

## Review Focus

1. **HTML-looking text in names or preferences** (`<img src=x onerror=alert(1)>`) — shown literally, never executed. Pinned in Task 4, Step 4.
2. **Messaging apps adding `?fbclid=…` or similar before the `#`** — the page still decodes, because it reads only `location.hash`; links contain only URL-safe characters. Pinned in Task 1 (`encoded is URL-safe`) and Task 3 (`buildLink strips query and hash`).
3. **Near-duplicate names** (`"Anna"` vs `" anna "`) — flagged as duplicates, draw blocked. Pinned in Task 2 (`validate flags case/space duplicates`).
4. **Very long preferences** (2000 characters, many lines) — round-trips intact and the reveal page scrolls on a phone. Pinned in Task 1 (`roundtrip long text`) and Task 4, Step 4.
5. **Corrupted or missing saved state** (`localStorage` holds garbage, or throws in private mode) — the admin panel opens with an empty list instead of a blank screen. Pinned in Task 3 (`parseState garbage → default`) and Task 5, Step 4.

---

## File Structure

```
.gitignore     .superpowers/
README.md      how to publish on GitHub Pages and use the panel (Polish)
common.js      window.SS: encode/decode, validate, draw, links, state parsing — pure, no DOM
tests.html     loads common.js + tests.js, shows results
tests.js       test harness + tests for common.js
index.html     reveal page (markup + CSS + small inline script using SS.decodePayload)
admin.html     admin markup + CSS
admin.js       admin UI: rendering, events, localStorage, clipboard, export/import
```

---

### Task 1: Repository, test harness, payload encoding

**Files:**
- Create: `.gitignore`, `common.js`, `tests.html`, `tests.js`

**Interfaces:**
- Produces:
  - `window.SS` global object (all later functions attach to it).
  - `SS.encodePayload(data: {g: string, r: string, p?: string, b?: string}) -> string` — URL-safe, adds `v: 1`.
  - `SS.decodePayload(s: string) -> {g: string, r: string, p: string, b: string} | null` — `null` on any problem; `p`/`b` default to `''`.
  - Test harness in `tests.js`: `test(name, fn)`, `eq(actual, expected, msg?)` (deep-equal via `JSON.stringify`), `ok(cond, msg?)`; after all tests it writes `PASS n/n` or `FAIL k/n` into `#summary` and lists failures in `#results`.

- [ ] **Step 1: `git init`, create `.gitignore` containing `.superpowers/`**

- [ ] **Step 2: Create `tests.html`** loading `common.js` then `tests.js`, with `<div id="summary">` and `<ul id="results">`. Create `tests.js` with the harness and these tests:

```js
test('roundtrip basic', () => {
  const d = { g: 'Anna', r: 'Tomek', p: 'książki sci-fi, kawa', b: '100 zł' };
  eq(SS.decodePayload(SS.encodePayload(d)), d);
});
test('roundtrip polish, emoji, newlines', () => {
  const d = { g: 'Łucja Żółć', r: 'Mikołaj', p: 'gry 🎲\nkawa ☕\n\nherbata', b: '' };
  eq(SS.decodePayload(SS.encodePayload(d)), d);
});
test('roundtrip long text', () => {
  const p = ('abc ąę\n').repeat(300);
  eq(SS.decodePayload(SS.encodePayload({ g: 'A', r: 'B', p, b: '50 zł' })).p, p);
});
test('missing p/b decode to empty strings', () => {
  eq(SS.decodePayload(SS.encodePayload({ g: 'A', r: 'B' })), { g: 'A', r: 'B', p: '', b: '' });
});
test('encoded is URL-safe', () => {
  ok(/^[A-Za-z0-9_-]+$/.test(SS.encodePayload({ g: 'Ż?&#=/+', r: 'ó', p: '<>"\'', b: '%' })));
});
test('recipient name not readable in link', () => {
  ok(!SS.encodePayload({ g: 'Anna', r: 'Tomek' }).includes('Tomek'));
  ok(!atobSafe(SS.encodePayload({ g: 'Anna', r: 'Tomek' })).includes('Tomek'));
});
test('decode rejects garbage', () => {
  [ '', 'x', '!!!', 'abc$%', SS.encodePayload({ g: 'A', r: 'B' }).slice(0, -3) ]
    .forEach(s => eq(SS.decodePayload(s), null, JSON.stringify(s)));
});
test('decode rejects wrong version and missing names', () => {
  eq(SS.decodePayload(rawEncode({ v: 2, g: 'A', r: 'B' })), null);
  eq(SS.decodePayload(rawEncode({ v: 1, g: '', r: 'B' })), null);
  eq(SS.decodePayload(rawEncode({ v: 1, g: 'A' })), null);
});
```

`atobSafe(s)` (base64url → binary string, no XOR) and `rawEncode(obj)` (the same pipeline as `encodePayload` but without adding `v` or validating) are test helpers defined in `tests.js`; `rawEncode` may call an internal `SS._scramble(bytes) -> bytes` that `common.js` exposes for tests.

- [ ] **Step 3: Open `tests.html` in the browser pane; expect `#summary` to read `FAIL` (SS undefined / functions missing).**

- [ ] **Step 4: Implement in `common.js`** (IIFE assigning `window.SS`):
  - Pipeline: `JSON.stringify` → `TextEncoder` bytes → `SS._scramble` (XOR each byte with the bytes of the constant key `'gwiazdor-2026'`, cycling) → base64url (`btoa` over a binary string, `+`→`-`, `/`→`_`, strip `=`).
  - `decodePayload`: reverse inside `try/catch`; reject unless the result is an object with `v === 1`, non-empty string `g` and `r`, and `p`/`b` absent or strings. Return only `{g, r, p, b}`.

- [ ] **Step 5: Reload `tests.html`; expect `PASS 8/8`.**

- [ ] **Step 6: Commit** — `git add .gitignore common.js tests.html tests.js` · `git commit -m "feat: payload encoding with in-browser tests"`

---

### Task 2: Validation and the draw

**Files:**
- Modify: `common.js`, `tests.js`

**Interfaces:**
- Produces:
  - `SS.normalizeName(name: string) -> string` — trims and collapses inner whitespace to single spaces.
  - `SS.validateParticipants(names: string[]) -> string[]` — list of Polish error messages, empty when valid. Messages, exactly:
    - `Potrzeba co najmniej 3 osób.`
    - `Każda osoba musi mieć imię.`
    - `Imię „{name}” występuje więcej niż raz.` (once per duplicated name, showing the first spelling)
  - `SS.draw(names: string[], random?: () => number) -> Record<string, string>` — giver → recipient using normalized names; throws `Error` if `validateParticipants` returns errors. `random` defaults to a `crypto.getRandomValues`-based float in [0,1).

- [ ] **Step 1: Add tests**

```js
test('validate ok', () => eq(SS.validateParticipants(['Anna', 'Tomek', 'Ola']), []));
test('validate too few', () => ok(SS.validateParticipants(['A', 'B']).includes('Potrzeba co najmniej 3 osób.')));
test('validate empty name', () => ok(SS.validateParticipants(['A', ' ', 'C']).includes('Każda osoba musi mieć imię.')));
test('validate flags case/space duplicates', () =>
  eq(SS.validateParticipants(['Anna', ' anna ', 'Ola']), ['Imię „Anna” występuje więcej niż raz.']));
test('draw: nobody draws themselves, is a permutation (1000 runs)', () => {
  for (let i = 0; i < 1000; i++) {
    const names = ['A', 'B', 'C', 'D', 'E'].slice(0, 3 + (i % 3));
    const m = SS.draw(names);
    eq(Object.keys(m).sort(), [...names].sort());
    eq(Object.values(m).sort(), [...names].sort());
    names.forEach(n => ok(m[n] !== n));
  }
});
test('draw uses normalized names', () => {
  const m = SS.draw(['  Anna ', 'Tomek', 'Ola']);
  ok('Anna' in m && !('  Anna ' in m));
});
test('draw throws on invalid input', () => {
  let threw = false; try { SS.draw(['A', 'B']); } catch { threw = true; } ok(threw);
});
test('draw varies', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(JSON.stringify(SS.draw(['A', 'B', 'C', 'D'])));
  ok(seen.size > 3);
});
```

- [ ] **Step 2: Reload `tests.html`; expect the new tests to fail.**

- [ ] **Step 3: Implement** `normalizeName`, `validateParticipants`, `draw`. Draw algorithm:

```js
do { shuffled = fisherYates([...names], random); }
while (shuffled.some((n, i) => n === names[i]));
// map names[i] -> shuffled[i]
```

- [ ] **Step 4: Reload; expect `PASS 16/16`.**

- [ ] **Step 5: Commit** — `git commit -am "feat: participant validation and derangement draw"`

---

### Task 3: Links and admin state helpers

**Files:**
- Modify: `common.js`, `tests.js`

**Interfaces:**
- Consumes: `SS.encodePayload`, `SS.normalizeName` (Tasks 1–2).
- Produces:
  - State shape (stored under `localStorage` key `gwiazdor.v1`):
    ```
    { budget: string, baseUrl: string,
      people: [{ id: string, name: string, prefs: string }],
      draw: Record<string, string> | null,      // normalized giver -> recipient
      copied: Record<string, string> }          // normalized giver -> link last copied
    ```
  - `SS.defaultState() -> State` — `{budget:'', baseUrl:'', people:[], draw:null, copied:{}}`.
  - `SS.parseState(json: string | null) -> State` — returns `defaultState()` for `null`, invalid JSON or wrong shape; fills missing fields with defaults.
  - `SS.drawMatches(state) -> boolean` — true when `draw` is non-null and its keys are exactly the set of normalized names in `people`.
  - `SS.buildLink(baseUrl: string, encoded: string) -> string` — drops any query and hash from `baseUrl`, then appends `#` + `encoded`.
  - `SS.linkFor(state, giver: string) -> string` — payload `{g: giver, r: state.draw[giver], p: prefs of that recipient (trimmed), b: state.budget.trim()}`, via `buildLink(state.baseUrl, …)`.
  - `SS.defaultBaseUrl(href: string) -> string` — for `http:`/`https:` returns the URL of the folder containing `href`, ending in `/`, without query or hash (e.g. `https://u.github.io/repo/admin.html?x#y` → `https://u.github.io/repo/`); for any other protocol returns `''`.
  - Names are compared and used as keys in normalized form (`SS.normalizeName`) everywhere: `draw` keys/values, `copied` keys, and the recipient-prefs lookup in `linkFor`.

- [ ] **Step 1: Add tests**

```js
test('buildLink strips query and hash', () =>
  eq(SS.buildLink('https://u.github.io/repo/?fbclid=1#old', 'XYZ'), 'https://u.github.io/repo/#XYZ'));
test('defaultBaseUrl https', () =>
  eq(SS.defaultBaseUrl('https://u.github.io/repo/admin.html?x=1#y'), 'https://u.github.io/repo/'));
test('defaultBaseUrl file', () => eq(SS.defaultBaseUrl('file:///D:/Repos/SecretSanta/admin.html'), ''));
test('parseState garbage → default', () => {
  eq(SS.parseState(null), SS.defaultState());
  eq(SS.parseState('{oops'), SS.defaultState());
  eq(SS.parseState('[1,2]'), SS.defaultState());
});
test('parseState fills missing fields', () =>
  eq(SS.parseState('{"budget":"50 zł"}'), { ...SS.defaultState(), budget: '50 zł' }));
const st = () => ({ ...SS.defaultState(), budget: ' 100 zł ', baseUrl: 'https://x/',
  people: [{ id: '1', name: 'Anna', prefs: ' kawa ' }, { id: '2', name: 'Tomek', prefs: '' }, { id: '3', name: 'Ola', prefs: 'gry' }],
  draw: { Anna: 'Tomek', Tomek: 'Ola', Ola: 'Anna' } });
test('drawMatches true', () => ok(SS.drawMatches(st())));
test('drawMatches false after add/remove/rename', () => {
  const a = st(); a.people.push({ id: '4', name: 'Ewa', prefs: '' }); ok(!SS.drawMatches(a));
  const b = st(); b.people.pop(); ok(!SS.drawMatches(b));
  const c = st(); c.people[0].name = 'Ania'; ok(!SS.drawMatches(c));
  const d = st(); d.draw = null; ok(!SS.drawMatches(d));
});
test('drawMatches ignores prefs/budget edits and whitespace', () => {
  const s = st(); s.people[0].prefs = 'nowe'; s.budget = '200 zł'; s.people[1].name = ' Tomek '; ok(SS.drawMatches(s));
});
test('linkFor carries recipient prefs and trimmed budget', () => {
  const link = SS.linkFor(st(), 'Ola');
  ok(link.startsWith('https://x/#'));
  eq(SS.decodePayload(link.split('#')[1]), { g: 'Ola', r: 'Anna', p: 'kawa', b: '100 zł' });
});
```

- [ ] **Step 2: Reload; expect the new tests to fail.**
- [ ] **Step 3: Implement the functions above in `common.js`.**
- [ ] **Step 4: Reload; expect `PASS 25/25`.**
- [ ] **Step 5: Commit** — `git commit -am "feat: link building and admin state helpers"`

---

### Task 4: Reveal page (`index.html`)

**Files:**
- Create: `index.html`

**Interfaces:**
- Consumes: `SS.decodePayload` (load `common.js` with a classic `<script src>`).

- [ ] **Step 1: Build the page from mockup B** (`.superpowers/mockups/page-styles.html`, the `.b` styles, SVG present, confetti and `open` class), adapted to a full mobile-first page (`min-height: 100dvh`, centred column, max-width ~420px, scrollable when content is tall):
  - `<title>` and `<meta property="og:title">` = `Gwiazdor 🎁 — Twoje losowanie`; `og:description` = `Otwórz, żeby zobaczyć, komu robisz prezent.`
  - The present is a `<button>` wrapping the SVG, `aria-label="Otwórz prezent"`; click, Enter and Space open it.
  - On load: `const d = SS.decodePayload(location.hash.slice(1))`. If `null`, hide the present and show `Ten link nie działa. Poproś organizatora o nowy.` Otherwise fill greeting `Cześć, {g}! 🎄`, hint, label `Twoja osoba to:`, name `r`, `Lista życzeń:` + `p` (whole block hidden when `p` is empty; `white-space: pre-line`), `Budżet: {b}` (hidden when `b` is empty). All via `textContent`.
  - Drop the mockup-only "wrap it again" button.

- [ ] **Step 2: Create a test link** — in the browser console on `tests.html`: `SS.buildLink(location.href.replace('tests.html','index.html'), SS.encodePayload({g:'Anna', r:'Tomek', p:'książki sci-fi\nkawa', b:'100 zł'}))`. Open it; tap the present.
  Expected: greeting `Cześć, Anna! 🎄`; after tapping, confetti, `Twoja osoba to:` / `Tomek`, two-line wish list, `Budżet: 100 zł`.

- [ ] **Step 3: Check the empty cases.** A link with `p:''` and `b:''` shows only the name — no `Lista życzeń`, no `Budżet`. `index.html` with no hash and with `#garbage` both show the bad-link message.

- [ ] **Step 4: Check Review Focus items** at 375×812 (phone preset):
  - `p` = `<img src=x onerror=alert(1)>` and `g` = `<b>Ola</b>`: shown as literal text, no alert.
  - `p` = 2000 characters across many lines: page scrolls, nothing cut off.
  - `index.html?fbclid=abc#<valid payload>`: decodes normally.

- [ ] **Step 5: Commit** — `git add index.html` · `git commit -m "feat: unwrap-the-present reveal page"`

---

### Task 5: Admin panel — settings, participants, persistence

**Files:**
- Create: `admin.html`, `admin.js`

**Interfaces:**
- Consumes: `SS.defaultState`, `SS.parseState`, `SS.defaultBaseUrl`, `SS.validateParticipants`, `SS.normalizeName`.
- Produces (inside `admin.js`, used by Task 6): `state` (module-level `State`), `save()` (writes `JSON.stringify(state)` to `localStorage['gwiazdor.v1']` inside `try/catch`; on failure shows the notice `Nie udało się zapisać danych w tej przeglądarce.`), `render()` (re-renders everything from `state`).

- [ ] **Step 1: `admin.html`** — Polish, clean and simple (Nunito, light background, a small 🎁 header `Gwiazdor — panel organizatora`). Sections:
  1. **Ustawienia** — `Budżet` text input (placeholder `np. 100 zł`); `Adres strony` URL input (placeholder `https://twoja-nazwa.github.io/SecretSanta/`) with hint `Tu będą prowadzić linki dla uczestników.`
  2. **Uczestnicy** — a row per person: `Imię` input, `Lista życzeń (opcjonalnie)` textarea, `Usuń` button; `+ Dodaj osobę` button below. Validation messages from `SS.validateParticipants` listed under the section (shown only once there are at least 2 rows or a Losuj attempt).
  3. **Losowanie** — container filled in Task 6.
  4. Footer: `Eksportuj`, `Importuj`, `Wyczyść wszystko` (wired in Task 6).
- Load `common.js` then `admin.js` with classic script tags.

- [ ] **Step 2: `admin.js` startup** — `state = SS.parseState(readStorage())` where `readStorage()` returns `null` if `localStorage` throws. If `state.baseUrl` is empty, set it to `SS.defaultBaseUrl(location.href)`. Then `render()`.

- [ ] **Step 3: Wire inputs** — every input/textarea change updates `state` and calls `save()`. Use the `input` event for text so nothing is lost on close. Add/Remove rows (`id` from `crypto.randomUUID()` or a counter). Re-render only the parts that need it so typing doesn't lose focus.

- [ ] **Step 4: Manual check in the browser pane:**
  - Add 3 people, budget and preferences with Polish characters; reload → all restored.
  - Type `Anna` and ` anna `: message `Imię „Anna” występuje więcej niż raz.`
  - In the console: `localStorage.setItem('gwiazdor.v1', '{oops')`; reload → panel opens empty, no errors in the console.
  - Opened via `file://`: `Adres strony` is empty; served over http: pre-filled with the folder URL.

- [ ] **Step 5: Commit** — `git add admin.html admin.js` · `git commit -m "feat: admin panel settings, participants and persistence"`

---

### Task 6: Admin panel — draw, links, maintenance

**Files:**
- Modify: `admin.html`, `admin.js`

**Interfaces:**
- Consumes: `state`, `save()`, `render()` (Task 5); `SS.draw`, `SS.drawMatches`, `SS.linkFor`, `SS.parseState`, `SS.defaultState` (Tasks 2–3).

- [ ] **Step 1: Draw section rendering** (inside `render()`):
  - No draw: `Losuj` button; disabled while `SS.validateParticipants` returns errors.
  - `state.draw` set but `!SS.drawMatches(state)`: notice `Lista osób się zmieniła — wylosuj ponownie.` and the `Losuj` button; results hidden.
  - Valid draw: one row per person in list order: `{giver} → {recipient}`, `Kopiuj link`, `Otwórz` (opens the link in a new tab). Under the list: `Losuj ponownie`.
  - Row marker `zmieniony — wyślij ponownie` when `state.copied[giver]` exists and differs from `SS.linkFor(state, giver)`; marker `skopiowany ✓` when equal.
  - When `state.baseUrl` is empty: `Kopiuj link` and `Otwórz` disabled, hint `Uzupełnij „Adres strony” w ustawieniach.`

- [ ] **Step 2: Actions**
  - `Losuj`: `state.draw = SS.draw(names); state.copied = {}; save(); render()`.
  - `Losuj ponownie`: `confirm('Wszyscy dostaną nowe osoby i trzeba będzie wysłać wszystkie linki od nowa. Losować ponownie?')`, then as `Losuj`.
  - `Kopiuj link`: `navigator.clipboard.writeText(link)`; on success set `state.copied[giver] = link`, save, show `Skopiowano!` on that button for ~1.5 s. If the clipboard API is missing or rejects, show the link in a read-only, pre-selected text field in that row and still record it as copied.
  - `Eksportuj`: download `gwiazdor-kopia.json` (Blob of `JSON.stringify(state, null, 2)`).
  - `Importuj`: hidden file input; read the file, `SS.parseState(text)`; if the result equals `SS.defaultState()` and the file wasn't empty, `alert('Ten plik nie wygląda na kopię z panelu Gwiazdora.')`, else replace `state`, save, render.
  - `Wyczyść wszystko`: `confirm('Usunąć wszystkie osoby i losowanie?')`, then `state = SS.defaultState()` (keep `baseUrl`), save, render.

- [ ] **Step 3: Manual check in the browser pane** (served or with `Adres strony` filled in):
  - 4 people → `Losuj` → 4 rows, nobody paired with themselves. Copy a link, open it → reveal page shows the right recipient, wish list and budget.
  - Edit that recipient's preferences → the giver's row shows `zmieniony — wyślij ponownie`; copy again → `skopiowany ✓`; new link shows the new preferences.
  - Add a 5th person → `Lista osób się zmieniła — wylosuj ponownie.`; remove them → the original draw is back.
  - `Losuj ponownie` → confirmation, then new pairs and all markers cleared.
  - Export, `Wyczyść wszystko`, Import → everything restored.
  - `file://` with empty `Adres strony` → copy disabled with the hint.

- [ ] **Step 4: Commit** — `git commit -am "feat: draw, link copying, export/import"`

---

### Task 7: README and end-to-end check

**Files:**
- Create: `README.md`

- [ ] **Step 1: `README.md` (Polish)** — what it is; how to publish (create a public GitHub repo, push, Settings → Pages → Deploy from branch → `main` / root); how to use (`…/admin.html`, fill in, Losuj, send each link privately); note that data lives only in the organiser's browser and to use Eksportuj for a backup; that the honour system applies (the panel shows all pairs).

- [ ] **Step 2: Full run in the browser pane at desktop size and at the phone preset:** `tests.html` shows `PASS 25/25`; admin flow from Task 6 Step 3 works; a reveal link works on the phone preset with no horizontal scroll.

- [ ] **Step 3: Check the repo holds no participant data** — `git grep -n -i "tomek\|anna"` matches only tests, README examples and mockup-derived copy; nothing under `.superpowers/` is tracked (`git ls-files .superpowers` prints nothing).

- [ ] **Step 4: Commit** — `git add README.md` · `git commit -m "docs: README with publishing instructions"`
