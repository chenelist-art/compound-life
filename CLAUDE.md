# Compound Life

A static website (no build step, no framework): a money life simulator inspired by 1in8b.life. Open `index.html` in a browser to run it. Owner: Chen, a business student; keep explanations in plain language.

## Structure
- `index.html` – landing page (hero banknote, money lab, birth map, decision list). Logic in `js/landing.js`.
- `play.html` – the game. Logic in `js/game.js`.
- `js/engine.js` – the simulation: country table `C`, decision deck `EV` (73 decisions), yearly `tick()`, passbook `trkView()`, and `projectEvent()` / `projectFocus()` (40 simulated futures per choice).
  - Each life is dealt its own mix: `planLife()` gives every event with `win:[from,to]` an age in that window, with chance `p` (scaled by `DENSITY`, about 45 decisions a life) and only if `only(s)` allows it at birth (country or family). `when(s)` is checked at the time. After two quiet years `pullForward()` brings the nearest open card forward (from the plan, then from `spare`), so something happens every year or two. No decision repeats in a life.
  - Consequences that arrive years later use `later(s, age, kind, data)`, resolved by `LATER[kind]` at the start of that year (friend repays, bubble bursts, divorce, layoffs, emergencies…). Draw their randomness with `evR(s, key)` so the 40 simulated futures see different outcomes.
  - Yearly costs you sign up for (pets, premiums, supporting parents) use `rec(s, id, amount, years)`; a negative amount is income. Pay changes (raises, a job abroad, going part-time) use `bump()`.
- `js/i18n.js` – all text in English (`EN`), Simplified Chinese (`ZH`) and Traditional Chinese (`ZHT`), plus money formatting (`fm`): $12k / $1.2万 / $1.2萬.
- `js/guilloche.js` – canvas rosettes drawn as picture-book suns and moons (`Guilloche.SUN`, `Guilloche.MOON`). `js/art.js` – tarot card pieces (`Art.card`, `Art.decorate`, Roman numerals) and one small SVG drawing per decision. `js/theme.js` – `fitText` (shrinks big numbers to fit).
- `css/style.css` – the whole design system, following `design/picture-book-style.md`. Colours are the six palette tokens on `:root`; never hard-code colours in components. Light theme only: no dark mode, no gradients, no blurred shadows.

## Rules
- **No hard-coded user-facing text in JS.** The engine stores messages as `M(key, vars)` and money as `MN(n)` / `MS(n)` (signed); the UI turns them into text with `t()` / `tr()` at render time, so switching language mid-game works.
- Adding or changing text means updating all three languages in `js/i18n.js` (`EN`, `ZH`, `ZHT`). Traditional Chinese uses Taiwan wording.
- Static HTML text uses `data-i18n="h.key"`; the English in the HTML is the English version, and `ZH`/`ZHT` need the `h.key` entry.
- Money is in PPP dollars, in today's money (inflation already removed). Stocks average ~5% real with yearly noise.
- "Where you stand" ranks (`worldPct`, `countryPct`, `incomePct` in `js/engine.js`) use real published data in `WEALTH_PCT`, `INCOME_PCT`, `WD` and `PPP`, each with its source and year in a comment (UBS Global Wealth Report / Databook 2023, World Bank PIP and WDI). Never add or change a number there without a source; anything modelled rather than published (ranks inside a country, below the world median, income vs pay) must stay labelled as an estimate, in the code and in the footer text `h.f2p3`.
- Keep it working at phone width (390px) with no sideways scrolling.
- Fonts come from Google Fonts: Huninn for everything, with Noto Sans SC as the fallback for Simplified Chinese.
- Gains and losses are shown with a marker underline (`.gain` / `.loss`), never with coloured text.
- Every decision in `EV` needs a tarot name `tn.<id>` in all three languages and a drawing in `js/art.js`. The 78-card deck is now fully used (22 major arcana, the four Coin court cards on the money card, and 52 minor arcana), so a new decision has to reuse a card name.
- Every decision's default option (`def`) must always be clickable, or the autopilot twin and the game can get stuck.
- Difficulty (setup screen, saved as `cl-diff`): **Easy** shows the 40-future projections before you choose, **Normal** (default) shows a hindsight card for a few seconds after you choose, **Hard** shows nothing until the end card. The end card lists every decision's hindsight in all modes.
- An option's `sub` (and an event's `text`) may only say what you'd know in real life: prices, pay, fees. Effects you couldn't know (skill gains, pay %, success odds) go in `hint` (`Hn(...)` on options, `hint:` on events), which only Easy shows.

## Checking changes
- Run a local server from this folder: `python -m http.server 8000`, then open http://localhost:8000.
- After engine changes, play at least one full life in each language and check the console for errors and for any raw keys like `e.car.t` showing on screen. With ~45 decisions a life, it also helps to simulate many lives in Node (load `js/i18n.js` then `js/engine.js` into one `vm` context, pick random options, `tick()` until death) and check for errors, stuck lives, repeats and untranslated text.
