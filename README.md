# Compound Life

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
Pick it on the setup screen; it's remembered like the language.
- **Easy**: before you choose, each option shows its typical result from 40 simulated futures.
- **Normal** (default): like real life, you only see prices, pay and fees. Right after you choose, a hindsight card shows how each option usually turned out.
- **Hard**: no hints at all. Every decision is revealed on the end card.

## Languages
Use the EN / 简 / 繁 switch in the top bar. The choice is remembered, and Chinese browsers start in Chinese automatically.


## Tuning the game
Country data is the `C` table at the top of `js/engine.js`: births, typical wage, life expectancy, home price in years of pay, and university fees in years of pay. Each decision is one entry in the `EV` list in the same file: 73 in all, from pocket money at 7 to a funeral plan at 90. Every life is dealt a different mix of about 45, with something happening every year or two. Some are country-specific (a 401(k) match in the US, EPF in Malaysia, CPF in Singapore) or family-specific (supporting your parents). Some have consequences years later: a friend may or may not repay you, a property boom may burst, a patched roof may fail. To change how many decisions a life gets, change `DENSITY` in `js/engine.js`.

All money is in PPP dollars and today's money. This is a game for learning, not financial advice.
