# Quizzes

The questions a page asks, one file per quiz: `quizzes/<id>.md`. A page names its quiz in its front matter (`quiz: <id>`, [`pages/README.md`](../pages/README.md)); a quiz belongs to one page only, and a page may have none. Answers are stored per quiz, so the answers to one quiz were all given in the context of the same page. Checked by `npm run validate`, with the pages.

## Layout

The file holds only the questions:

4–8 questions, asked in this order: first the pool's, as a list of ids, then the quiz's own (a news page's quiz), each under its own heading:

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

The heading is the question's text. Under it, a table of its fields from the pool's schema (`questions/README.md`), `id` first: `type`, `measures`, `where`, `maxSelect`, `group`, `ageRanges`, `na`, `scale` (lowest … highest) and `outlook` (choice: value, …). Then its options, numbered; the answers store them as letters, 1 as `a`, 2 as `b` and so on, which is what `outlook` names. The `id` is kebab-case and unique in the quiz; answers are stored as `<quiz id>-<id>`. Once a quiz is published its questions keep what they ask: the same text, options and order (`npm run questions-unchanged`, on every pull request); a new development is a new question. `src/quizfile.ts` reads them; the build joins them to the page that names the quiz.

## Rules

- **4–8 questions,** at least 3 of them answerable where the reader lives (below).
- **One question, one quiz.** No question is in two quizzes, so nobody answers the same question twice, and no quiz holds two questions of the same `group`.
- **At least 3 questions a resident can answer.** A page whose quiz has fewer than 3 questions for where someone lives (a question's `where`) is hidden from them.
- **A news page's quiz: questions about the reader, not about the event.** What it changes for them, what they expect, whom they trust, what they would choose. Never who is to blame, never parties or politicians, and every rule in [QUIZ.md](../questions/QUIZ.md).
- **A quiz keeps its questions.** Once published, a question keeps its text, options and their order; a new development gets a new question (`npm run questions-unchanged`).
