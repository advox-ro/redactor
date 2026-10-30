# Pages

The pages shown on advox.ro's home page, one after another; readers see each one as a quiz. One file per page: `pages/<slug>.md`, with everything about it (see Layout). Deploying the redactor publishes them: they are built into its Worker, and the site reads them from there. There are two kinds:

- **Pages on a part of life** take their questions from the pool in [`questions/`](../questions/README.md) and their figures from one page of [`wiki/`](../wiki/README.md).
- **Pages from the news** (with a `date`) are about something that happened in the last days. They write their own questions, take their figures from the press and lead the feed, newest first. Check them with:

```sh
npm run validate
```

## Layout

A page's file holds, in this order, a short front matter, its cards and, for a news page, its articles. Its questions are a quiz of their own, `quizzes/<id>.md` ([`quizzes/README.md`](../quizzes/README.md)), which the page names with `quiz:`; the build joins the two. `src/pagefile.ts` reads the page, for the build, the validator and the fact check alike.

````markdown
---
title: La medic                     # at most 32 characters; the slug is the file name
summary: Medicul de familie, …      # one sentence, at most 140 characters: what the page asks about
tags: [sănătate, servicii publice]  # 1–3, lowercase; the feed filters by them. "județ" shows as the reader's county ("Cluj")
counties: [B, IF]                   # optional: a local page, shown only there (codes from src/counties.ts, DSP for the diaspora)
order: 2                            # place in the feed
wiki: sanatate                      # the wiki page the cards come from
sources: [1, 3, 12]                 # numbers from that page's Surse list, for every card below
stat: { value: "1.055", label: "localități aveau prea puțini medici de familie la sfârșitul lui 2025" }
image:                              # optional (required with a date): the cover photo, in pages/photos/
  src: /photos/la-doctor.jpg
  alt: Spitalul Colțea din București
  credit: Jorge Franganillo          # author, as the licence asks
  license: CC BY 2.0                 # a free licence: CC0, public domain, CC BY, CC BY-SA
  url: https://commons.wikimedia.org/wiki/File:…
  illustrative: true                 # the photo shows the subject, not the event itself
quiz: la-doctor                     # optional: its questions, quizzes/la-doctor.md; the quiz of this page only
---

## Carduri

### Unde lipsește medicul de familie
tip: cifră
- 1.055
de localități aveau prea puțini medici de familie la sfârșitul lui 2025.

### Cât pune statul
tip: comparație
- România: 6,2%
- Media UE: 10,2%
din PIB s-au cheltuit pe sănătate în 2024, cel mai puțin din UE.
````


A page from the news adds a `date` (the day of the news), the quotes each card rests on and its articles; its quiz asks questions of its own:

````markdown
---
date: 2026-10-27
stat: { value: "20%", label: "din curentul țării vine de la Cernavodă", quote: "Cernavodă produce de obicei 20% din curentul țării", source: 2 }
---

## Carduri

### Oprite de la jumătatea verii
tip: cronologie
- 28 iulie: se oprește reactorul 1
- 13 august: se oprește și reactorul 2
Dunărea a scăzut prea mult ca să le mai răcească.
> „Reactorul 1 a fost oprit controlat la 28 iulie, iar Reactorul 2 a fost oprit la 13 august.” [1]

## Surse

1. Starea de alertă la Centrala de la Cernavodă a fost prelungită — Digi24. https://www.digi24.ro/…
2. Criza de la Cernavodă se prelungește cu încă o lună — Ziarul Financiar. https://www.zf.ro/…
````

- Under each card, the sentences of the articles it rests on, word for word, each with its number in Surse. They stay in the file; the site shows the cards without them.
- `stat` may carry the sentence its number comes from (`quote`, `source`).
- Surse is written as in the wiki, `n. Title — Outlet. https://…`, and is the list of articles the site shows under the page.

`wiki` and `sources` are optional on a news page and add background from the wiki. `stat` is optional when there is a photo.

## Cards

The site shows a page as a row of cards, swiped one by one on a phone: the cover (title, summary, the quiz's button), then the page's cards, the sources and the quiz. Each card is `### Title`, `tip: <kind>`, its data as `- label: value` items, then a sentence or two. The site draws the data by kind:

| `tip:` | Data | Drawn as |
| --- | --- | --- |
| `cifră` | one item, `- 517.100` | the figure, large |
| `comparație` | two to five items, `- România: 6,2%` | bars from zero, one per item |
| `evoluție` | two or more items in time order, `- Aug. 2026: 6,4%` | a line through the values, the last one marked |
| `parte` | one item, `- 30,8%` or `- 2 din 5` (up to 10) | 100 dots, or a few large ones, the share lit |
| `clasament` | `- Libertatea presei: 49 din 180`, then earlier places, `- 2025: 55` | the place on a line from first to last |
| `cronologie` | two or more items, `- 14 septembrie: incendiul` | a timeline |
| `voci` | two or more items, `- Nuclearelectrica: încă nu sunt îndeplinite condițiile` | who says what, side by side |
| `text` | none | the sentence alone |

`npm run validate` checks that each card has what its kind needs: values of a comparison or a line in one unit, a share up to 100%, a ranking as a place out of a total.

## Rules

- **A page is one thing from someone's life** (going to the doctor, the bills, the commute), not a whole wiki domain. Its quiz may take questions from several domains when they belong together.
- **No two pages on the same thing.** The validator flags pages whose titles and summaries share most of their words, or that use the same key figure.
- **Facts as the wiki states them.** The key figure and the cards repeat the wiki page, with its numbers and dates, and every one of them is in `sources`. Good figures as well as bad ones.
- **A neutral key figure.** The cover's `stat` stands alone, with nothing beside it to balance it, so it gives the size of the subject (how many, how much, how often), not a verdict on it. No evaluative words ("prea", "doar", "record", "cel mai"…). No comparison or ranking picked to make it look good or bad (against the EU, the best county against the worst). No shortfall where a size will do. Never other people's opinions, and never a figure that answers one of the page's own questions: it would tell readers what others answered before they answer. A page with a photo can do without one. `npm run validate` catches the words; the second reading judges the rest.
- **Plain language.** Write for someone reading on a phone who doesn't follow the news closely: short sentences, everyday words, and any institution or term explained the first time.
- **News pages: facts from at least two outlets.** Everything on the cards appears in one of the articles in Surse (or the wiki sources), as they report it. When the outlets disagree, the page says what each one reports or leaves it out. When a side denies the accusations, the page says so too.
- **News pages: their evidence on record.** Under each card, the sentences of the articles it rests on, word for word, and the sentence behind the key figure in `stat`. `npm run check-page -- pages/<slug>.md` fetches every article and holds the page to them: every quote in its article, every number of a card (title, data, sentence) in its quotes, every number of the summary and the key figure in some quote of the page (`src/pagecheck.ts`).
- **Photos with a free licence only,** from Wikimedia Commons or similar, with author and licence shown on the page. Press photos are not used. A photo that shows the subject and not the event is marked `illustrative`.
- **Local pages name their counties.** A story about some counties only (a weather warning, a closed road, a county hospital) lists them in `counties`, and only people from there see it. A page for people abroad only is `counties: [DSP]` and needs at least 3 questions they can answer. A story that matters to the whole country stays without `counties`, even if it happened in one place.
- The body follows the wiki's style: plain sentences, no slogans, no questions to the reader.
- **Cards that tell the story.** Think of the cards as a short story someone swipes through on the phone: what happened or how things stand, how big it is, how it compares or changed, who says what, what comes next. Usually four to six. Each one says one thing, with a title that says it in plain words (not "Pe scurt" or "Cifre"), and the kind that shows it best; a sentence explains what the drawing can't. Write them from the articles or the wiki, not from a list of facts.
- **Honest drawings.** A chart can mislead more easily than a sentence. Compare only what the source compares, in the same unit and period; no figure worked out by you (a share, a difference, a per-person value) unless the source gives it; the side that looks better and the one that looks worse both stay in.
