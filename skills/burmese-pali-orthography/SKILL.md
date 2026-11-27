---
name: burmese-pali-orthography
description: "Enforces Unicode canonical character order, medials, kinzi, stacked consonants and punctuation when writing Burmese or Pāḷi in Myanmar script. Use when generating, editing or checking Burmese (Myanmar) or Pāḷi text in Myanmar Unicode, including Zawgyi-to-Unicode fixes."
---

# Burmese & Pāḷi (Myanmar Script) Generation Rules

When generating Burmese or Pāḷi text in Myanmar Unicode (`U+1000`–`U+109F`), always output **strict Unicode canonical storage order**, never visual typing order or Zawgyi-One encodings.

## 1. Canonical Syllable Storage Order

Every Myanmar syllable MUST follow this exact code-point sequence:

1. **Base Consonant** (`က` `U+1000` – `အ` `U+1021`, or independent vowels `ဣ`, `ဤ`, `ဥ`, `ဦ`, `ဧ`, `ဩ`, `ဪ`)
2. **Stacked Subscript Consonant** (Pāḷi/loanwords only): Virama `္` (`U+1039`) + Subscript Consonant
3. **Medials** (must appear in this strict relative order):
   - Ya-pin `ျ` (`U+103B`)
   - Ya-yit `ြ` (`U+103C`)
   - Wa-hswe `ွ` (`U+103D`)
   - Ha-hto `ှ` (`U+103E`)
4. **Front Vowel (E-vowel)**: `ေ` (`U+1031`), stored AFTER consonant/medials, even though it renders visually to the left
5. **Upper/Lower Vowels**:
   - Upper: `ိ` (`U+102D`), `ီ` (`U+102E`), `ဲ` (`U+1032`)
   - Lower: `ု` (`U+102F`), `ူ` (`U+1030`)
6. **Anusvara / Niggahīta**: `ံ` (`U+1036`)
7. **Right Vowel (Aa-vowel)**: `ာ` (`U+102C`) or tall `ါ` (`U+102B`)
8. **Final Consonant + Asat (Killer)**: Final Consonant + `်` (`U+103A`)
9. **Tone Marks** (must appear last in the syllable):
   - Aukmyit (creaky tone): `့` (`U+1037`)
   - Visarga (heavy tone): `း` (`U+1038`)

### Critical Ordering Examples

- **ကြောင်း** (_reason_): `က` + `ြ` (`U+103C`) + `ေ` (`U+1031`) + `ာ` (`U+102C`) + `င` + `်` (`U+103A`) + `း` (`U+1038`)
- **မြှင့်** (_to raise_): `မ` + `ြ` (`U+103C`) + `ှ` (`U+103E`) + `ိ` (`U+102D`) + `င` + `်` (`U+103A`) + `့` (`U+1037`)
- **နိဒ္ဒေသ** (_exposition_): `န` + `ိ` + `ဒ` + `္` (`U+1039`) + `ဒ` + `ေ` (`U+1031`) + `သ`

---

## 2. Pāḷi-Specific Rules in Myanmar Script

### A. Stacked Consonants (Pāḷi Ligatures & Geminates)

Use **Virama** (`္` `U+1039`), NOT Asat (`်` `U+103A`), to stack a consonant beneath the preceding consonant:

- **Geminates (doubled consonants):** `က္က` (kka), `စ္စ` (cca), `တ္တ` (tta), `ဒ္ဒ` (dda), `န္န` (nna), `ပ္ပ` (ppa), `ဗ္ဗ` (bba), `မ္မ` (mma), `လ္လ` (lla), `ဿ` (`U+103F`, ssa).
- **Aspirated clusters:** `က္ခ` (kkha), `ဂ္ဃ` (ggha), `စ္ဆ` (ccha), `ဇ္ဈ` (jjha), `ဋ္ဌ` (ṭṭha), `ဍ္ဎ` (ḍḍha), `တ္ထ` (ttha), `ဒ္ဓ` (ddha), `ပ္ဖ` (ppha), `ဗ္ဘ` (bbha).
- **Nasal + Stop clusters:** `င်္ဂ` (ṅga), `ဉ္စ` (ñca), `ဉ္ဇ` (ñja), `ဏ္ဍ` (ṇḍa), `န္တ` (nta), `န္ဒ` (nda), `မ္ပ` (mpa), `မ္ဗ` (mba).
- **Special Pāḷi Ligatures:**
  - `ဉာ` (`U+1009` + `U+102C`) for _ñā_ (as in `ပညာ` vs `ဝိညာဏ်`).
  - `ဋ္ဌ` (`U+100B` + `U+1039` + `U+100C`) for _ṭṭha_ (as in `ကမ္မဋ္ဌာန်း`).
  - `ဏ္ဌ` (`U+100F` + `U+1039` + `U+100C`) for _ṇṭha_.

### B. Kinzi (`င်္`) Formation & Placement

When nasal `င` (`U+1004`) precedes another consonant in Pāḷi (e.g., _Saṅgha_, _Maṅgala_, _Saṅkhāra_), it forms a **Kinzi** sitting above the following consonant:

- **Exact code-point sequence:** `င` (`U+1004`) + **Asat** `်` (`U+103A`) + **Virama** `္` (`U+1039`) + `[Following Consonant]`
- **Examples:**
  - _Saṅgha_: `သ` + `င` + `်` + `္` + `ဃ` → **သင်္ဃ**
  - _Maṅgala_: `မ` + `င` + `်` + `္` + `ဂ` + `လ` + `ာ` → **မင်္ဂလာ**
  - _Saṅkhāra_: `သ` + `င` + `်` + `္` + `ခ` + `ါ` + `ရ` → **သင်္ခါရ**

### C. Tall `ါ` (`U+102B`) vs. Standard `ာ` (`U+102C`)

Use **Tall `ါ` (`U+102B`)** to prevent visual ambiguity with the base letter `ဝ` (`wa`) after round or open-right consonants:

- **Always use `ါ` after:** `ခ`, `ဂ`, `င`, `ဒ`, `ပ`, `ဝ` (e.g., `ပါရမီ`, `ဒါန`, `သင်္ခါရ`, `မဖြစ်ပါ`).
- **Exception:** When these consonants carry a medial or stacked subscript that alters their right-side profile, use standard `ာ` (`U+102C`) (e.g., `ပွား`, `ခွာ`, `ကြာ`, `မြန်မာ`).

### D. Niggahīta (`ံ` `U+1036`) vs. Final Nasals (`န်` / `မ်`)

- In **pure Pāḷi** words/verses, use `ံ` (`U+1036`) for word-final _-ṃ_ (e.g., `ဗုဒ္ဓံ`, `ဓမ္မံ`, `သံဃံ`, `သရဏံ ဂစ္ဆာမိ`).
- In **Burmese-assimilated Pāḷi nouns**, use the orthographic final consonant + Asat (`U+103A`) (e.g., `နိဗ္ဗာန်`, `ဈာန်`, `သတိပဋ္ဌာန်`, `ဝိညာဏ်`, `ကုသိုလ်`).

---

## 3. Punctuation, Numerals & Spacing

- **Word & Phrase Spacing:** Burmese does not put spaces between every word. Use spaces (`U+0020`) only between **phrases, clauses, or semantic chunks** to aid readability.
- **Punctuation:**
  - `၊` (`U+104A`, _Pote Phyat_): Comma / minor clause pause.
  - `။` (`U+104B`, _Pote Ma_): Period / full stop at the end of a sentence or Pāḷi gāthā line.
  - Never substitute ASCII `/` or `?` or `||` for `၊` and `။`.
- **Numerals:** Use Myanmar digits (`၀ ၁ ၂ ၃ ၄ ၅ ၆ ၇ ၈ ၉`, `U+1040`–`U+1049`) in Burmese prose and Pāḷi section numbering. Do not confuse Myanmar zero `၀` (`U+1040`) with the consonant `ဝ` (`U+101D`).

---

## 4. Forbidden Anti-Patterns (Self-Check Before Output)

1. **Never place `ေ` (`U+1031`) before the base consonant** (e.g., `ေမတ္တာ` typed visually instead of `မေတ္တာ`).
2. **Never use Asat (`်` `U+103A`) alone to stack consonants** (use Virama `္` `U+1039`).
3. **Never write Kinzi without both Asat and Virama** (`င` + `်` + `္`).
4. **Never output Zawgyi-specific encodings**: visually reordered text (E-vowel typed before the consonant), and the legacy glyph code points in `U+1060`–`U+1097` that Zawgyi uses for stacked or width-variant forms. `U+103B` (Ya-pin) is a standard Unicode medial, so keep using it.
5. **Never confuse `ဉ` (`U+1009`, nya-galay) with `ဥ` (`U+1025`, independent vowel u)**: for example, write `ဥပေက္ခာ` (with `ဥ`) and `ဉာဏ်` / `ပညာ` (with `ဉ` / `ည`).
