# JuChess Web Brand Guide

Source: [JU Chess guideline, 2026](https://canva.link/t3uq1yb2fuwphok), 14 slides.
This is a website implementation of the brand guide, not a copy of the slide layouts.

## Visual direction

- Slides 1-4 introduce the rook and the brand guide. Slides 5-6 describe a
  minimal, classic identity with subtle modern details and playful chess motifs.
- Slide 7 shows three marks: the rook/clock-tower symbol, the wordmark, and the
  combined mark. Use the compact symbol in constrained spaces, combine it with
  the site name where the club needs to be identified, and use the light mark
  on dark backgrounds. Slides 9 and 11 demonstrate color pairings for the mark.
- The home hero has a light, rook-only animation, hidden when reduced motion
  is requested. The tournament card and news remain driven by Appwrite data.

## Color roles

The guide defines the primary and secondary groups on slides 8 and 10. The
roles below are web implementation decisions. The website consumes the
same CSS token file exported by the palette page.

| Group | Color | Value | Web role |
| --- | --- | --- | --- |
| Primary | Ivory Surface | `#FFFCF4` | Content surfaces and text on primary actions |
| Primary | Cream | `#F5EFE3` | Page background and light alternate surfaces |
| Primary | Deep Burgundy | `#5F1B26` | Primary actions, selected navigation and focus outlines |
| Primary | Ink | `#111111` | Text and dark surfaces |
| Secondary | Warm Muted | `#6D625B` | Supporting text and visible borders on light surfaces |
| Secondary | Soft Gold | `#C9AE6B` | Ornament and accents on dark surfaces |
| Secondary | Mocha | `#422B1C` | Warm contrast and supporting detail |
| Secondary | Soft Burgundy | `#7A2431` | Supporting brand accents and primary hover |

Calculated contrast: Ivory on Deep Burgundy **12.26:1**, Ink on Cream
**16.49:1**, Warm Muted on Ivory **5.77:1**, and Mocha on Cream **11.50:1**.
Soft Gold reaches **8.77:1** on Ink, but only **2.10:1** on Ivory. Do not
use it as readable text or as the sole focus or selection indicator on Ivory.
Game state, evaluation, and error colors are separate from the brand palette.

## Typography

- **Imbue**, slide 12: English titles and headlines. The guide shows light,
  regular and bold. The website loads the existing variable font locally.
- **Finland Rounded**, slide 13: English descriptions and details. The
  website declares it as the preferred face, but uses a rounded/system
  sans-serif fallback until licensed webfont files are supplied. Do not
  bundle Canva-hosted or personal-use demo files.
- **Kufam**, slide 14: Arabic. The website loads the local variable font
  for Arabic glyphs and uses it for Arabic-language heading and body elements.
  This does not add Arabic translations to the existing English copy.
- Keep monospace for chess notation, PGN and verification codes, where
  character alignment and legibility matter more than the brand face.
