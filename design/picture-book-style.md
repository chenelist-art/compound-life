
# Japanese Picture-Book Style

Apply this style to any visual output (HTML pages, artifacts, designs, SVG illustrations) when the user asks for it or for a destination/travel piece in this look.

## Aesthetic
- Japanese picture-book style: cute, minimalist, friendly.
- Light backgrounds only. Never use dark mode or dark backgrounds.
  - One deliberate exception: at the very end of the life replay the screen slowly fades to charcoal (#3E3A39) for "Was it all worth it?" in washi-white text, then fades back to light. Nothing else may use a dark background.

## Canvas & outlines
- Background: washi white `#FFFCF6`.
- Outlines: 3px bold charcoal `#3E3A39` on cards, shapes and illustrations.
- Large rounded corners (around 20-28px on cards, fully rounded on pills/buttons).
- Flat color fills only. No gradients, no drop-shadow blur (a solid offset shadow in charcoal is fine).

## Color palette
| Name | Hex |
|---|---|
| Coral Pink | `#F2A497` |
| Yamabuki Yellow | `#F6D27A` |
| Mizu Light Blue | `#A8D3E6` |
| Wakatake Green | `#B9DAA5` |
| Washi White (bg) | `#FFFCF6` |
| Charcoal (outline/text) | `#3E3A39` |

Use charcoal for body text. Use the four colors as fills for cards, tags, icons and illustration areas, not for text.

## Typography
- Google Fonts "Huninn" (jf open 粉圓) for everything.
- Load with: `<link href="https://fonts.googleapis.com/css2?family=Huninn&display=swap" rel="stylesheet">`
- `font-family: 'Huninn', sans-serif;`

## Illustration
- Draw custom inline SVGs tailored to the destination's distinct motifs: landmarks, local transportation, scenery, food.
- Keep them simple: flat palette fills, 3px charcoal strokes, rounded line caps and joins, small cute details (e.g. a smiling sun, puffy clouds).
- Don't use stock photos or generic icons when an illustration would fit.

## CSS starter tokens
```css
:root {
  --washi: #FFFCF6;
  --charcoal: #3E3A39;
  --coral: #F2A497;
  --yamabuki: #F6D27A;
  --mizu: #A8D3E6;
  --wakatake: #B9DAA5;
  --outline: 3px solid var(--charcoal);
  --radius: 24px;
}
body { background: var(--washi); color: var(--charcoal); font-family: 'Huninn', sans-serif; }
.card { border: var(--outline); border-radius: var(--radius); }
```

## Checklist before delivering
- Background is washi white, nothing dark (except the charcoal moment at the end of the life replay).
- Every card/shape has the 3px charcoal outline and rounded corners.
- No gradients anywhere.
- Only palette colors used.
- Huninn font loaded and applied.
- At least one custom SVG specific to the destination.