# A Second Chance (重来人生 / 重來人生)

A money life simulator. You're born at random, every big decision is about money, and you watch each choice compound for the rest of your life.

## Open it
Double-click `index.html`. It runs in any modern browser with no install. You need internet the first time so the fonts load.

## Files
- `index.html` is the landing page: the animated banknote, the money lab, the birth map and the list of decisions.
- `play.html` is the game itself.
- `css/style.css` holds the whole design system (the picture-book palette, type and tarot cards).
- `js/engine.js` is the simulation: countries, life events, yearly money model, and the 40 simulated futures behind each choice.
- `js/game.js` is the game screen. `js/landing.js` runs the landing page.
- `js/i18n.js` holds every piece of text in English, Simplified Chinese and Traditional Chinese, plus the money format ($12k / $1.2万 / $1.2萬). Change a line there to reword anything.
- `js/guilloche.js` draws the sun and moon rosettes. `js/art.js` draws the tarot cards and one picture per decision. `js/theme.js` shrinks big numbers to fit.

## Difficulty
Pick it on the setup screen; it's remembered like the language. Difficulty changes the rules of life, not just the hints.
- **Easy**: the original, gentler rules. Before you choose, each option shows its typical result from 40 simulated futures.
- **Normal** (default): like real life. More surprise bills and medical bills, rents that rise faster than pay, spending that creeps up as you earn more, higher tax on high pay, crashes of different depths and sometimes a lost decade for stocks, degrees and courses that sometimes teach less than you hoped, and real trade-offs (saving a lot or working long hours costs happiness, health and time with people). You only see prices, pay and fees. Right after you choose, a hindsight card shows how your own choice usually turned out.
- **Hard**: all of that, harsher, and no hints at all. Every decision is revealed on the end card.

## The end grade
Every life ends with a grade from S to D. Money counts for a quarter; happiness, health and a long life, and relationships count for the rest, and a point gained where you're weak counts more than one where you're already strong. So the richest life isn't always the best one.

## Balance test
`node tools/balance.js` plays 500 lives on each difficulty with four bots (a "smart" one that always invests, studies, buys insurance and never gambles; a random one; one that always takes the default; and a mix) and prints their net worth, happiness, health, grades, survival and setbacks. `node tools/balance.js normal 300 opt` also checks, for every decision, how often each option turned out to be the best one. Run it after changing the numbers in `js/engine.js`.

## Languages
Use the EN / 简 / 繁 switch in the top bar. The choice is remembered, and Chinese browsers start in Chinese automatically.


## Tuning the game
Country data is the `C` table at the top of `js/engine.js`: births, typical wage, life expectancy, home price in years of pay, and university fees in years of pay. Each decision is one entry in the `EV` list in the same file: 96 in all, from a hobby at 6 to a funeral plan at 90. Every life is dealt a different mix of about 50, with something happening every year or two. Some are country-specific (a 401(k) match in the US, EPF in Malaysia, CPF in Singapore) or family-specific (supporting your parents). Some have consequences years later: a friend may or may not repay you, a property boom may burst, a patched roof may fail. To change how many decisions a life gets, change `DENSITY` in `js/engine.js`. What each difficulty changes is the `DF` table near the top of the same file.

All money is in PPP dollars and today's money. This is a game for learning, not financial advice.
