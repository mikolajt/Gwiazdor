# Secret Santa ("Gwiazdor") — design

Date: 2026-11-17
Status: draft, awaiting approval

## Intent

A small web app for running a Secret Santa among friends or family. The organiser (who also takes part) types in everyone's names, optional gift preferences and a shared budget, runs the draw, and gets one private link per person. They send the links themselves (Messenger, SMS, etc.). Opening a link shows a playful page: a wrapped present that the person taps to unwrap, revealing who they are buying for, what that person would like and the budget.

It should be fun to open, trivial to host for free, and need no accounts or servers.

## Goals

- Admin panel: enter participants (name + optional preferences), budget, run the draw, copy each person's link.
- Personal page: "unwrap the present" reveal (mockup B), showing recipient name, preferences (only if not empty) and budget.
- Free static hosting on GitHub Pages from a public repository, without putting any assignment in the repository.
- Works well on phones, since most links will be opened from a messaging app.
- All user-facing text in Polish.

## Non-goals

- Sending links (email/SMS) from the app — the organiser sends them by hand.
- Participants entering their own preferences.
- Draw rules beyond "nobody draws themselves" (no couples/exclusions, no history).
- Real secrecy from the organiser: the admin panel shows the full draw; it is an honour system.
- Strong encryption. Links are only scrambled so the recipient's name can't be read off the URL at a glance.
- Accounts, logins, a database or any server code.
- Multiple simultaneous events.

## Anti-goals (failure even if it "works")

- An assignment can be found by browsing the public repository or the site.
- A link preview in a messaging app reveals the recipient (title/description must be generic).
- Anyone draws themselves.
- The word "Mikołaj" is used for the Santa role (a participant may be called Mikołaj); use "Gwiazdor".
- A name appears in an inflected form ("dla Tomka"); names always appear in the form typed in.
- Gendered wording that is wrong for some participants ("Jesteś Gwiazdorem", "chciałby"). Copy must read correctly for anyone: "Twoja osoba to:", "Lista życzeń:", "Cześć, {imię}!".
- The reveal page looks broken on a phone.

## Constraints

- GitHub Pages on a free account → the repository is public.
- No Node.js on the organiser's machine today; the app must not need a build step. Plain HTML, CSS and JavaScript.
- Fonts from Google Fonts must support Polish characters (ą, ć, ę, ł, ń, ó, ś, ź, ż). Nunito does; Mountains of Christmas does not, so it is not used.

## Approaches considered

1. **Static site, assignment carried in the link (chosen).** `admin.html` + `index.html` on GitHub Pages. Each link's fragment (`#…`) holds that person's scrambled assignment. Nothing secret is stored in the repo, nothing is re-uploaded after a draw, no build step. Trade-off: if someone's preferences change after links are sent, their Santa needs a fresh link.
2. **One generated HTML file per person committed to the repo.** Rejected: the public repo would expose every assignment, and every draw or change needs a commit and push.
3. **Hosted app with a database (e.g. Firebase).** Would allow self-entered preferences and live edits, but needs project setup, access rules and possibly logins — far more than this needs. Rejected.

The organiser picked approach 1.

## Design

### Files

```
index.html     personal reveal page (what participants open)
admin.html     organiser panel
common.js      shared: payload encode/decode, draw logic
styles/…       optional, if CSS is split out
tests.html     in-browser tests for common.js (no Node needed)
```

Both pages load `common.js`. No frameworks or build step.

### Link format

`https://<user>.github.io/<repo>/#<payload>`

- Payload = JSON `{"v":1,"g":"Anna","r":"Tomek","p":"…","b":"100 zł"}` (giver, recipient, preferences, budget; `v` is a format version).
- Encoding: JSON → UTF-8 bytes → XOR with a fixed key in `common.js` → base64url. This is obfuscation only.
- The data lives in the URL fragment, which browsers never send to the server.
- Decoding failure, missing fragment or unknown `v` → friendly error page: "Ten link nie działa. Poproś organizatora o nowy."

### Personal page (`index.html`) — mockup B, in Polish

Reference mockup: `.superpowers/mockups/page-styles.html`, option B.

- Dark navy radial background, Nunito font.
- Greeting: "Cześć, {g}! 🎄", hint: "Twoja osoba jest w środku… Stuknij prezent!"
- Wrapped present (inline SVG) wiggles every few seconds. Tapping it (or Enter/Space — it is a button) lifts the lid away, fires confetti, shrinks the present and reveals:
  - label "Twoja osoba to:" and the name `r` in large type,
  - **"Lista życzeń:"** followed by `p` — the whole block hidden when `p` is empty,
  - "Budżet: {b}" — hidden when `b` is empty.
- The reveal plays every time the link is opened (no memory between visits).
- `<title>` and Open Graph tags are generic ("Gwiazdor 🎁 — Twoje losowanie"), so link previews never reveal anything.
- Line breaks typed into preferences are preserved; all user text is inserted as text, never as HTML.

### Admin panel (`admin.html`)

Single page, Polish, works on desktop and phone.

1. **Ustawienia:** budget (free text, e.g. "100 zł"); site address (pre-filled from the page's own location when served over http(s); editable, required when the panel is opened from a local file so links point at GitHub Pages and not at `file://`).
2. **Uczestnicy:** a row per person — name (required) and preferences (optional, multi-line). Add / remove rows. Names must be unique (case-insensitive, trimmed); duplicates are flagged and block the draw. At least 3 people are required.
3. **Losowanie:** "Losuj" button. Result list: one row per person showing "Anna → Tomek" and a "Kopiuj link" button (copies to the clipboard, with a visible "Skopiowano!" confirmation; falls back to a selectable text field if the clipboard API is unavailable). Optional "Otwórz" to preview the page.
4. **Editing after the draw:**
   - Changing someone's preferences or the budget keeps the pairs; links regenerate automatically. The rows whose links changed are marked "zmieniony — wyślij ponownie" until copied again.
   - Adding or removing a person, or renaming one, invalidates the draw: the result list is hidden and a notice asks for a new draw.
   - "Losuj ponownie" asks for confirmation ("Wszyscy dostaną nowe osoby i trzeba będzie wysłać wszystkie linki od nowa.").
5. **Persistence:** everything (settings, participants, the draw) is saved to `localStorage` on every change and restored on load. "Eksportuj" downloads a JSON backup; "Importuj" loads one — useful for moving to another computer or browser.
6. **Wyczyść wszystko** with confirmation.

### Draw

Random derangement: shuffle the participant list (Fisher–Yates, `crypto.getRandomValues`) and retry until no one is assigned themselves. Sub-cycles (A↔B) are allowed. With at least 3 participants this terminates quickly (expected ~2.7 tries).

### Hosting

- Public GitHub repo, GitHub Pages serving the default branch's root.
- Nothing in the repo identifies participants. `.superpowers/` (mockups) goes in `.gitignore`.
- The admin panel is publicly reachable but empty for anyone else — data lives only in the organiser's browser.

### Testing

`tests.html` runs plain-JS assertions on `common.js` in the browser:
- encode → decode round-trips, including Polish characters, emoji, empty fields and line breaks;
- corrupted / missing / wrong-version payloads are rejected;
- the draw never assigns anyone to themselves, always produces a permutation, and refuses fewer than 3 or duplicate names (run many times).

The pages themselves are checked by hand on desktop and a phone-sized viewport.

Reveal label "Twoja osoba to:" was chosen by the organiser.

## Calls made by Claude (not explicitly decided by the organiser)

- Minimum of 3 participants; unique names required.
- XOR + base64url scrambling and the payload field names.
- `localStorage` persistence plus JSON export/import.
- Editing preferences/budget after the draw keeps pairs; adding/removing/renaming people forces a redraw.
- Gender-neutral copy ("Lista życzeń:"); generic page title for link previews.
- If the panel is opened from a local file and the site address is empty, "Kopiuj link" is disabled with a hint to fill it in.
- Site-address field in the admin panel so links work when the panel is opened locally.
- In-browser `tests.html` rather than a Node test runner.

## Left to the builder

- Exact Polish copy and small jokes on the reveal page (keep the tone of mockup B, no "Mikołaj").
- Visual styling of the admin panel (clean and simple; it is a tool, not the show).
- Whether CSS lives inline or in separate files.
