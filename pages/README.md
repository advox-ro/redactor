# Pages

The pages shown on advox.ro's home page, one after another; readers see each one as a quiz. One file per page: `pages/<slug>.md`, with everything about it (see Layout). Deploying the redactor publishes them: they are built into its Worker, and the site reads them from there. There are two kinds:

- **Pages on a part of life** take their questions from the pool in [`questions/`](../questions/README.md) and their facts from one page of [`wiki/`](../wiki/README.md).
- **Pages from the news** (with a `date`) are about something that happened in the last days. They write their own questions, take their facts from the press and lead the feed, newest first. Check them with:

```sh
npm run validate
```

## Layout

Everything about a page is in its file, in this order: a short front matter, the facts, the questions and, for a news page, its articles. `src/pagefile.ts` reads it, for the build, the validator and the fact check alike.

````markdown
---
title: La medic                     # at most 32 characters; the slug is the file name
summary: Medicul de familie, …      # one sentence, at most 140 characters: what the page asks about
tags: [sănătate, servicii publice]  # 1–3, lowercase; the feed filters by them. "județ" shows as the reader's county ("Cluj")
counties: [B, IF]                   # optional: a local page, shown only there (codes from src/counties.ts, DSP for the diaspora)
order: 2                            # place in the feed
wiki: sanatate                      # the wiki page the facts come from
sources: [1, 3, 12]                 # numbers from that page's Surse list, for every fact below
stat: { value: "1.055", label: "localități aveau prea puțini medici de familie la sfârșitul lui 2025" }
image:                              # optional (required with a date): the cover photo, in pages/photos/
  src: /photos/la-doctor.jpg
  alt: Spitalul Colțea din București
  credit: Jorge Franganillo          # author, as the licence asks
  license: CC BY 2.0                 # a free licence: CC0, public domain, CC BY, CC BY-SA
  url: https://commons.wikimedia.org/wiki/File:…
  illustrative: true                 # the photo shows the subject, not the event itself
---

- Two or three facts, one per item, a sentence or two each.

## Întrebări

- sanatate-001
- sanatate-003
````

4–8 questions, asked in this order: first the pool's, as a list of ids, then the page's own (a news page), each under its own heading:

```markdown
### Cât de îngrijorat(ă) ești că factura ta la curent va crește în această iarnă?

| id | factura |
|---|---|
| type | scale |
| measures | expectation |
| where | romania |
| scale | Deloc îngrijorat(ă) … Foarte îngrijorat(ă) |
| na | Nu plătesc eu factura la curent |
| outlook | 1: 1, 2: 0.5, 3: 0, 4: -0.5, 5: -1 |

### Cu ce îți încălzești în principal locuința în această iarnă?

| id | incalzire |
|---|---|
| type | single |
| measures | experience |

1. Centrală proprie pe gaz
2. Altfel
```

The heading is the question's text. Under it, a table of its fields from the pool's schema (`questions/README.md`), `id` first: `type`, `measures`, `where`, `maxSelect`, `group`, `ageRanges`, `na`, `scale` (lowest … highest) and `outlook` (choice: value, …). Then its options, numbered; the answers store them as letters, 1 as `a`, 2 as `b` and so on, which is what `outlook` names. The `id` is kebab-case and unique in the page; answers are stored as `<slug>-<id>`. Once a page is published its questions keep what they ask: the same text, options and order (`npm run questions-unchanged`, on every pull request); a new development is a new question. `src/pagefile.ts` turns them into the data the site reads, at every build.

A page from the news adds a `date` (the day of the news), its own questions, the quotes each fact rests on and its articles:

````markdown
---
date: 2026-10-27
stat: { value: "20%", label: "din curentul țării vine de la Cernavodă", quote: "Cernavodă produce de obicei 20% din curentul țării", source: 2 }
---

- Unitatea 1 a fost oprită pe 28 iulie, iar unitatea 2 pe 13 august.
  > „Reactorul 1 a fost oprit controlat la 28 iulie, iar Reactorul 2 a fost oprit la 13 august.” [1]

## Întrebări

### Cu ce îți încălzești în principal locuința în această iarnă?

| id | incalzire |
|---|---|
| type | single |
| measures | experience |

1. Centrală proprie pe gaz
2. Altfel

## Surse

1. Starea de alertă la Centrala de la Cernavodă a fost prelungită — Digi24. https://www.digi24.ro/…
2. Criza de la Cernavodă se prelungește cu încă o lună — Ziarul Financiar. https://www.zf.ro/…
````

- Under each fact, the sentences of the articles it rests on, word for word, each with its number in Surse. They stay in the file; the site shows the facts without them.
- `stat` may carry the sentence its number comes from (`quote`, `source`).
- Surse is written as in the wiki, `n. Title — Outlet. https://…`, and is the list of articles the site shows under the page.

`wiki` and `sources` are optional on a news page and add background from the wiki. `stat` is optional when there is a photo.

## Rules

- **One question, one page.** No question is in two pages, so nobody answers the same question twice, and no page holds two questions of the same `group`.
- **A page is one thing from someone's life** (going to the doctor, the bills, the commute), not a whole wiki domain. It may take questions from several domains when they belong together.
- **No two pages on the same thing.** The validator flags pages whose titles and summaries share most of their words, or that use the same key figure.
- **Facts as the wiki states them.** The key figure and the body repeat the wiki page, with its numbers and dates, and every one of them is in `sources`. Good figures as well as bad ones.
- **A neutral key figure.** The cover's `stat` stands alone, with nothing beside it to balance it, so it gives the size of the subject (how many, how much, how often), not a verdict on it. No evaluative words ("prea", "doar", "record", "cel mai"…). No comparison or ranking picked to make it look good or bad (against the EU, the best county against the worst). No shortfall where a size will do. Never other people's opinions, and never a figure that answers one of the page's own questions: it would tell readers what others answered before they answer. A page with a photo can do without one. `npm run validate` catches the words; the second reading judges the rest.
- **Plain language.** Write for someone reading on a phone who doesn't follow the news closely: short sentences, everyday words, and any institution or term explained the first time.
- **At least 3 questions a resident can answer.** A page with fewer than 3 questions for where someone lives (a question's `where`) is hidden from them.
- **News pages: facts from at least two outlets.** Every fact in the body appears in one of the articles in Surse (or the wiki sources), as they report it. When the outlets disagree, the page says what each one reports or leaves it out. When a side denies the accusations, the page says so too.
- **News pages: questions about the reader, not about the event.** What it changes for them, what they expect, whom they trust, what they would choose. Never who is to blame, never parties or politicians, and every rule in [QUIZ.md](../questions/QUIZ.md).
- **News pages: their evidence on record.** Under each fact, the sentences of the articles it rests on, word for word, and the sentence behind the key figure in `stat`. `npm run check-page -- pages/<slug>.md` fetches every article and holds the page to them: every quote in its article, every number of the facts in their quotes, every number of the summary and the key figure in some quote of the page (`src/pagecheck.ts`).
- **Photos with a free licence only,** from Wikimedia Commons or similar, with author and licence shown on the page. Press photos are not used. A photo that shows the subject and not the event is marked `illustrative`.
- **Local pages name their counties.** A story about some counties only (a weather warning, a closed road, a county hospital) lists them in `counties`, and only people from there see it. A page for people abroad only is `counties: [DSP]` and needs at least 3 questions they can answer. A story that matters to the whole country stays without `counties`, even if it happened in one place.
- The body follows the wiki's style: plain sentences, no slogans, no questions to the reader.
