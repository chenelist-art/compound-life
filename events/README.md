# Events: how to add and change decisions

Every decision in the game is a block of data in one of these JSON files. Adding an event means adding a block; no
JavaScript needs to change. After editing, run:

```
node tools/build.js        checks everything, plays 60 test lives, then writes gen/ (what the pages load)
node tools/validate.js     the same checks with 300 test lives, without writing anything
```

If something is wrong, the build says where (file, event, option) and writes nothing. Commit `gen/` together with your
edits: the site loads `gen/`, not these files.

## Files

| File | What's in it |
|---|---|
| `childhood.json`, `career.json`, `money.json`, `home.json`, `family.json`, `health.json`, `later-life.json` | the general deck, by theme |
| `country-MY.json` … `country-VN.json` | cards only for lives born in that country (`"country": "MY"` at the top) |
| `_shared.json` | option sets several events share (`templates`) and consequences several events schedule (`later`) |
| `../i18n/en.json`, `zh.json`, `zht.json` | the rest of the game's text (buttons, passbook, diary lines…) |

A new theme file works too: it is dealt after the themes above. When two cards are due in the same year, country cards
come first, then the files in that order, then the order inside the file.

## A small event

```json
{
 "id": "phone",
 "age": [26, 38],
 "weight": 0.7,
 "def": "mid",
 "tarot": {"en": "Four of Cups", "zh": "圣杯四", "zht": "聖杯四"},
 "art": "phone",
 "opts": [
  {"id": "top", "sub": {"a": "MN(.05 * base)"}, "do": "spend('phone', .05 * base, 'trk.phoneTop'); happy += 2"},
  {"id": "mid", "sub": {"a": "MN(.015 * base)"}, "do": "spend('phone', .015 * base, 'trk.phoneMid'); happy += 1"},
  {"id": "keep"}
 ],
 "i18n": {
  "en": {".t": "A new phone", ".x": "Your phone is slow…", ".top": "The newest model", ".top.s": "{a}. Happiness +2.", "…": "…"},
  "zh": {"…": "…"},
  "zht": {"…": "…"}
 }
}
```

It can come up once between 26 and 38, in about 70% of lives (before the deck's overall density is applied), offers
three options, and "mid" is the default (what the autopilot twin picks and what happens if you skip).

## Event fields

| Field | Meaning |
|---|---|
| `id` | unique name: lower-case letters, digits and `_`. Text keys start with `e.<id>.` |
| `age` | `[from, to]`: the card gets one year in this window. `[30, 30]` is a fixed age. Leave it out for cards that come with the situation (`when`) or as a follow-up (`chain`) |
| `weight` | chance (0–1) it is in a life at all, or an expression such as `"fam === 'poor' ? .85 : .3"`. Default 1 |
| `dens` | rarely needed: overrides how much the deck density scales the weight (country cards use 0.8) |
| `if` | who can get it, checked at birth: country, family, sex (see Conditions) |
| `when` | checked each year it could come up (see Conditions) |
| `chain` | `true`: only comes as a follow-up another choice scheduled (see Follow-up cards) |
| `def` | id of the default option. It must always be clickable (no `ok`) |
| `tarot` | its tarot name in the three languages, or the id of a card to borrow it from (`"tarot": "lend"`) |
| `art` | a drawing in `js/art.js` by name (`"art": "phone"`), or a shared drawing with a window colour: `{"draw": "rosca", "bg": "mi"}` (`co`, `ya`, `mi`, `wa`, `wh`). A shared drawing takes the numeral and frame colour of the card whose tarot name it borrows |
| `let` | values worked out when the card is shown, usable everywhere in the event: `{"a": ".3 * liquid()"}` |
| `fn` | helpers the options share: `{"go": {"args": ["x"], "do": "pay(x); happy -= 1"}}`, then `"do": "go(a)"` |
| `vars` | values for the card's text `e.<id>.x`: `{"a": "MN(a)"}`. Or `text`: any expression giving the message |
| `hint` | extra line shown only in Easy (effects you couldn't know in real life): `true` for `e.<id>.h`, or values, or an expression |
| `pre` / `preLog` | a script that runs once before the card shows (a crash lowering prices), and a diary line for it |
| `again` | a script after the choice that lets the card come back (it clears `done.<id>`) |
| `surv`, `care` | for illness cards: count survivors in the projections; a care line shown with the card |
| `use`, `with` | take the options from a template in `_shared.json`: `"use": "flood", "with": {"prem": .006, "prep": .01}` |
| `later` | consequences that arrive in a later year (see Consequences) |
| `src` | where the facts and figures come from (country cards must have one; mark guesses as ESTIMATE) |
| `i18n` | the text, in `en`, `zh` and `zht` (see Text) |

## Options

| Field | Meaning |
|---|---|
| `id` | the option's name (its text is `e.<event>.<id>`, and `.s` for the line under it, `.h` for its Easy hint) |
| `sub` | values for the line under it: `{"a": "MN(.05 * base)"}`. Only what you'd know in real life: prices, pay, fees |
| `hint` | Easy-only line with effects you couldn't know (skill, odds): `true`, values, or an expression |
| `ok` | `true`, or a message saying why it can't be picked now: `"liquid() >= a || M('.need')"` |
| `show` | leave the option out when this is false |
| `rel` | moves Relationships by this much (the change shows in Easy) |
| `do` | the script: what happens when it is picked |
| `next` | a follow-up card: `{"event": "lend_back", "in": [2, 4], "p": 0.5, "data": {"a": "a"}}` |
| `label` | only when the label isn't `e.<event>.<id>`: an expression |
| `each`, `as`, `max` | one option per item of a list: `"each": "[55, 60, 65, 70]", "as": "r", "id": "String(r)"` (then `id` is an expression) |

Options you can't afford are greyed out by the game on its own; you don't need an `ok` for that.

## Conditions (`if` and `when`)

All the checks listed must hold. Anything else goes in `test`, an expression.

| Check | Example | Meaning |
|---|---|---|
| `country` | `"MY"` or `["MY", "SG"]` | born in |
| `family` | `["poor", "working"]` | poor, working, middle, rich |
| `sex` | `"f"` | f or m |
| `age` | `[18, 63]` | age now |
| `working` | `true` | has a career, not studying, not retired |
| `job`, `studying`, `retired` | `true` / `false` | has a career / is studying / has retired |
| `house`, `car`, `insured`, `married`, `abroad` | `true` / `false` | |
| `partner` | `["living", "married"]` | single, dating, living, married |
| `kids` | `true` or `[1, 2]` | has children / how many |
| `kidAge` | `[0, 1]` | has a child aged 0 to 1 |
| `career`, `careerType` | `["civ"]`, `["office", "hands"]` | career id / family (office, hands, creative, sport, own) |
| `selfEmployed`, `canWorkAbroad` | `true` | |
| `difficulty` | `["normal", "hard"]` | |
| `stats` | `{"liquid": "> .3 * base", "health": "< 50"}` | health, happy, rel, skill, cash, debt, liquid, netWorth, salary, sloan, kids |
| `test` | `"!(hWait > age)"` | any expression |

`if` should only use what is fixed at birth (country, family, sex); the validator warns otherwise.

## Scripts and expressions

They look like JavaScript but can only touch the life being played:

- `happy += 2`, `health -= 4`, `cash += a`: a plain name is a field of the life (`base` is a typical wage there,
  `age`, `cash`, `debt`, `house.value`, `kids.length`, `job.id`…). The validator refuses names a life doesn't have.
- `let x = …` for a value inside the script; `if (…) { … } else { … }`; `for (const k in lots) { … }`; `return` in helpers.
- `Math.min`, `Math.max`, `Math.round`, `Math.floor`…; `? :`, `&&`, `||`.
- Verbs (from `js/verbs.js`), each acting on the life:

| Verb | What it does |
|---|---|
| `pay(a)` | pay from cash, then savings, then debt |
| `spend(id, a, 'trk.x')` | one-off spending, tracked in the passbook as what it would have grown to |
| `rec(id, a, years, health)` | a yearly cost for some years (negative = income); optional Health change a year |
| `T(id, {kind, label, …})` | open a passbook line (returns it, so you can change `.v` and `.note`) |
| `addSkill(src, points, M('trk.x'))` | Skill, with its passbook line |
| `bump(id, m, M('trk.x'))` / `tmpPay(id, m, years, 'trk.x')` | a lasting / temporary pay change |
| `mkLot(id, {rate, lock}, 'trk.x')`, `addLot(id, a)`, `putIn(id, a, {…}, 'trk.x')`, `yearly(id, {amt, until}, {…}, 'trk.x')` | savings and investments |
| `buy(P)`, `buyAt(P, {dp, fee, r, n, lk})` | buy a home |
| `later(age, 'kind', {…})` | a consequence in a later year (see below) |
| `next('event', years, {…})` | a follow-up card (see below) |
| `rl(d)` | change Relationships |
| `roll('key')` | a random number 0–1, the same for this life, year and key (so the 40 futures differ) |
| `log(M('log.x'), 'good')` | a diary line (in consequences) |
| `M('.key', {…})`, `MN(a)`, `MS(a)` | text to show (`.key` is this event's own), money, signed money |
| `salary()`, `skill()`, `liquid()`, `netWorth()`, `price()`, `rent()`, `working()` | read the life |

The full list, with careers, illness, contracts abroad, pensions and health schemes, is the table at the end of
`js/verbs.js`.

## Text

Each event has `i18n.en`, `i18n.zh` and `i18n.zht` with the same keys. A key starting with `.` belongs to the event:
`".t"` is `e.<id>.t` (the title), `".x"` the card's text, `".top"` an option's label, `".top.s"` the line under it,
`".top.h"` its Easy hint. Other keys (passbook lines `trk.…`, notes `note.…`, diary lines `log.…`) are kept as they are,
so an event can carry its own. Traditional Chinese uses Taiwan wording.

- `{a}` shows a value given in `vars`, `sub` or `M(…, {a: …})`; the validator checks every `{a}` gets a value.
- `{n:a year|# years}` picks the first text when n is 1 and the second otherwise; `#` is the number.
- Money is in PPP dollars of today (`MN(.3 * base)`): no currency symbols in the text.

## Follow-up cards ("three years later…")

A choice can schedule another card. The follow-up has `"chain": true` and no `age`:

```json
{"id": "lend", "…": "…", "opts": [{"id": "all", "do": "pay(a)", "next": {"event": "lend_back", "in": [2, 4], "data": {"a": "a"}}}]},
{"id": "lend_back", "chain": true, "def": "ok", "vars": {"a": "MN(chain.a)"}, "…": "…"}
```

It comes up in the year scheduled (a random year in `[2, 4]` here), once, when its `when` also holds; `chain` holds the
`data` it was given. `"p": 0.5` makes it happen only half the time. A script can also call `next('lend_back', 3, {a: a})`.

## Consequences that arrive later

For an outcome without a card (a friend repays, a bubble bursts), a script calls `later(age + 3, 'repay', {a: a})` and
the event (or `_shared.json`, if several events use it) says what happens then; the data is `x`:

```json
"later": {"mlm": "if (roll('mlm') < .1) { cash += .5 * base; log(M('log.mlmOk'), 'good') } else log(M('log.mlmNo'), 'bad')"}
```

## Templates

When many events offer the same choices (floods, savings groups, contracts abroad, civil-service exams, bonus months,
inflation), the options live once in `_shared.json` under `templates`, with their text under the template's `key`
(`e.flood.cover`…). An event uses one with `"use": "flood"` and gives the numbers in `"with"`; the template's scripts know
the event's id as `id`. Its card title and text are still the event's own.

## Checklist for a new event

1. Copy a similar event and give it a new `id`.
2. Set `age`, `weight`, `if` / `when`, `def`.
3. Write the options: what's known goes in `sub`, effects you couldn't know in `hint`.
4. Text in all three languages; a tarot name (or borrow one) and a drawing.
5. A source in `src` for any real-world fact or figure; ESTIMATE for guesses.
6. `node tools/build.js`, then `node tools/balance.js` if it changes money or odds.
