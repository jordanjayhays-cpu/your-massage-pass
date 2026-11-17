# Letter fonts

Static TTF instances (no `fvar` table), embedded (subset) in every letter PDF.
All three families are under the SIL Open Font License 1.1 (texts in `LICENSES/`).

| File | Use | Source (npm, `npm pack`) | SHA-256 |
|---|---|---|---|
| `Fraunces-SemiBold.ttf` | wordmark "Massage Club" | `@expo-google-fonts/fraunces@0.4.1`, `600SemiBold/Fraunces_600SemiBold.ttf` | `9f03c0fe70d1670d22f392a138ac02eceedc5eee5f1cd8d7486ba2aed843b8aa` |
| `Outfit-Regular.ttf` | body, sender block, opt-out box, privacy block | `@expo-google-fonts/outfit@0.4.3`, `400Regular/Outfit_400Regular.ttf` | `f24945365147c9e783e91d8649959b59be6b00c9ee4ecd2f6b33afbb2dd871fe` |
| `Outfit-Medium.ttf` | first line of the sender block, opt-out and privacy lead words, QR caption | `@expo-google-fonts/outfit@0.4.3`, `500Medium/Outfit_500Medium.ttf` | `1669995dee77438b732d6557d71ed4e807dd6ebb82704b55385938727c6841e2` |
| `Arimo-Regular.ttf` | recipient address only (Arial-metric sans serif, as Hispapost asks) | `@expo-google-fonts/arimo@0.4.3`, `400Regular/Arimo_400Regular.ttf` | `88cc899855d30f9c779b73c3319d0e077b098f927187aafce11ca029add707a6` |

Checked on 17 Nov 2026 with fontkit: no `fvar` table, and every character the
letter uses (accents, ñ, €, •, ¿, ¡, « », “ ”, ’, º, ª) has a glyph.

The SHA-256 of each file is part of every letter's render inputs: replacing a
font changes the inputs, so every unsent letter re-renders and needs approving
again.
