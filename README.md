# A Second Chance (重来人生 / 重來人生)

A life simulator about money, time and the people around you. You arrive at random, one among eight billion, and watch every choice quietly shape the rest of your life.

## Open it
Double-click `index.html`. It runs in any modern browser with no install. You need internet the first time so the fonts load.

## Files
- `index.html` is the landing page: the animated banknote, the money lab, the birth map and the list of decisions.
- `play.html` is the game itself.
- `css/style.css` holds the whole design system (the picture-book palette, type and tarot cards).
- `events/` holds every decision as data, one JSON file per theme (childhood, career, money, home, family, health, later life, and `life.json` for the cards about life rather than money) and one per country, with its text in all three languages. `events/README.md` explains how to add one.
- `js/people.js` keeps the people in your life, and the parts of a life that aren't money: keeping in touch, memories, dreams, the kind of person you were and regrets.
- `i18n/` holds the rest of the text, one file per language.
- `gen/` is what the pages load, made from `events/` and `i18n/` by `node tools/build.js`. Don't edit it by hand.
- `js/engine.js` is the simulation: countries, the yearly money model, and the 40 simulated futures behind each choice. `js/deck.js` turns the event data into the deck; `js/script.js` reads the small scripts that say what each choice does, and `js/verbs.js` lists what they can do.
- `js/game.js` is the game screen. `js/landing.js` runs the landing page.
- `js/i18n.js` loads only the language in use and formats money ($12k / $1.2万 / $1.2萬). To reword anything, change it in `i18n/` or in the event's own file, then run `node tools/build.js`.
- `js/guilloche.js` draws the sun and moon rosettes. `js/art.js` draws the tarot cards and one picture per decision. `js/theme.js` shrinks big numbers to fit.

## Difficulty
Pick it on the setup screen; it's remembered like the language. Difficulty changes the rules of life, not just the hints.
- **Easy**: the original, gentler rules. Before you choose, each option shows its typical result from 40 simulated futures.
- **Normal** (default): like real life. More surprise bills and medical bills, rents that rise faster than pay, spending that creeps up as you earn more, higher tax on high pay, crashes of different depths and sometimes a lost decade for stocks, degrees and courses that sometimes teach less than you hoped, and real trade-offs (saving a lot or working long hours costs happiness, health and time with people). You only see prices, pay and fees. Right after you choose, a hindsight card shows how your own choice usually turned out.
- **Hard**: all of that, harsher, and no hints at all. Every decision is revealed on the end card.

## More than money
About a third of the decisions in a life are about life, not money (`events/life.json`, marked `"life": true`), and they take the place of some money cards, so a life is no longer than before.
- **People you can lose touch with.** Your mother calls, an old friend messages you, a brother turns 40, a festival brings the family home (Lebaran, Tết, Obon, Thanksgiving, Christmas, Día de Muertos and more, in all 17 countries). Answering usually costs a little time or Happiness. Ignore someone three times and a friend drifts out of your life, or family becomes distant; the diary says so, and years later you may get a chance to make peace.
- **Memories.** Teaching your child to ride a bike, a road trip with your best friend, being there when a parent was in hospital, your wedding day. They go into a scrapbook on the end card and into the replay, and the past-lives list keeps a few.
- **Dreams that come back.** The guitar you played at 15 can turn up in a cupboard at 44. Pick it up again (sometimes you join a band and make a new friend), let it go, or leave it for later. A dream you had at 16 (to travel, to write a book, to learn a language) comes back too.
- **Choices with no right answer.** Covering for a coworker, telling a friend a hard truth, keeping a promise that costs you something. No option is cheaper or better, and nothing is hinted in any difficulty. The end card says, in words, what kind of person you were.
- **Regrets.** At the end, up to three things left unsaid, from what actually happened: a parent who died while you were distant, a friend you lost, a child's early years spent working, the trip you never took.

## The end grade
Every life ends with a grade from S to D. Money counts for a quarter; happiness, health and a long life, and relationships count for the rest, and a point gained where you're weak counts more than one where you're already strong. So the richest life isn't always the best one. Memories, the kind of person you were and regrets never change the grade.

## Balance test
`node tools/balance.js` plays 500 lives on each difficulty with four bots (a "smart" one that always invests, studies, buys insurance and never gambles; a random one; one that always takes the default; and a mix) and prints their net worth, happiness, health, grades, survival and setbacks. `node tools/balance.js normal 300 opt` also checks, for every decision, how often each option turned out to be the best one. Run it after changing the numbers in `js/engine.js`.

## Checking your changes
`node tools/build.js` checks every event (conditions, scripts, text in all three languages, drawings, follow-up cards) and plays 60 test lives before writing `gen/`; it writes nothing if something is wrong. `node tools/validate.js` does the same with 300 lives.

## Languages
Use the EN / 简 / 繁 switch in the top bar. The choice is remembered, and Chinese browsers start in Chinese automatically.


## Tuning the game
Country data is the `C` table at the top of `js/engine.js`: births, typical wage, life expectancy, home price in years of pay, and university fees in years of pay. Each decision is one entry in `events/`: 842 in all (359 of them country cards, 72 about life rather than money), from a hobby at 6 to a funeral plan at 90. Every life is dealt a different mix of about 90, a third of them about life, with something happening every year or two. Some are country-specific (a 401(k) match in the US, EPF in Malaysia, CPF in Singapore) or family-specific (supporting your parents). Some have consequences years later: a friend may or may not repay you, a property boom may burst, a patched roof may fail. A choice can also bring a follow-up card a few years later. Every life also has named people (parents, brothers and sisters, a best friend, a partner, children, a boss, a mentor) with names from the country, who grow older, marry, retire and pass away, and whose closeness to you rises or falls with your choices. To change how many decisions a life gets, change `DENSITY` in `js/engine.js`; `MONEYW` next to it sets how much less often money cards are dealt to make room for the life cards. What each difficulty changes is the `DF` table near the top of the same file.

All money is in PPP dollars and today's money. This is a game for learning, not financial advice.
