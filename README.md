# redactor

Redactorul citește presa din România, grupează articolele pe subiecte și propune quizuri pentru [advox.ro](https://advox.ro). Propunerile le scrie Vox, inteligența artificială a advox. Fiecare propunere devine un pull request în [advox-ro/site](https://github.com/advox-ro/site), iar un om o citește și decide dacă se publică.

## Cum lucrează

| Când (UTC) | Ce face | Unde |
|---|---|---|
| La 30 de minute | Citește fluxurile de știri, păstrează articolele noi și le pune în subiecte | `src/ingest.ts` |
| 02:00 | Aduce din repository-ul site-ului quizurile publicate, întrebările și wiki-ul | `src/sync.ts` |
| 03:30 | Alege subiectele zilei | `src/pick.ts` |
| La 15 minute, 04:00–08:59 | Scrie quizul pentru următorul subiect ales și deschide pull request-ul | `src/newsroom.ts` |

- **Subiecte.** Fiecare articol primește un vector (embedding, modelul bge-m3) din titlu și primele rânduri. Un articol intră într-un subiect deschis dacă e destul de apropiat de el (`JOIN` în `src/ingest.ts`), altfel începe unul nou. Un subiect rămâne deschis 72 de ore de la ultimul articol. Un articol preluat aproape identic de la altă publicație nu se numără ca a doua sursă.
- **Alegerea.** Codul măsoară câte tipuri de publicații scriu despre subiect, dacă advox.ro a mai întrebat despre el și dacă subiectul crește. Vox citește candidații și spune ce fel de știre e fiecare, câți oameni atinge și dacă se pot pune întrebări despre cititor fără vinovați și fără partide. Limitele sunt în cod: cel mult trei quizuri naționale și câte unul local pe județ pe zi. O zi fără niciun quiz e un rezultat bun.
- **Faptele.** Vox scoate din articole afirmații, fiecare cu propoziția din care vine. Codul o păstrează doar dacă propoziția apare cuvânt cu cuvânt în articol și dacă fiecare număr din afirmație e în ea (`src/facts.ts`). Quizul se scrie numai din aceste afirmații.
- **Quizul.** Vox îl scrie după regulile site-ului ([quizzes/README.md](https://github.com/advox-ro/site/blob/main/quizzes/README.md) și [questions/QUIZ.md](https://github.com/advox-ro/site/blob/main/questions/QUIZ.md)), citite din repository la fiecare rulare. Codul scrie fișierul, ca formatul să fie mereu cel așteptat de site (`src/draft.ts`).
- **Verificările.** Întâi cele din cod: lungimi, numărul de întrebări și de variante, fiecare număr din fapte, rezumat și cifra-cheie regăsit în afirmațiile citate, cel puțin două publicații și, la un quiz național, două tipuri de publicații. Apoi o verificare independentă: Vox, fără să vadă cum a fost scrisă propunerea, caută reguli încălcate, fapte nesusținute și întrebări care sugerează un răspuns (`src/checks.ts`). O propunere care nu trece nici după o corectură nu ajunge la om.
- **Fotografia.** Doar de pe Wikimedia Commons, cu licență liberă (CC0, domeniu public, CC BY, CC BY-SA), niciodată foto de presă. Vox se uită la candidate și o alege pe cea care arată subiectul, sau niciuna (`src/photo.ts`).
- **Costul.** Fiecare apel către Vox se înregistrează, iar peste plafonul zilnic (`DAILY_BUDGET_USD` în `wrangler.jsonc`) nu se mai face niciunul.

## Sursele

Fluxurile sunt în [`src/sources.ts`](src/sources.ts), verificate unul câte unul. Publicațiile sunt grupate după ce sunt (radio și televiziune publică, agenții, televiziuni, ziare și site-uri, presă economică, presă de investigație, presă de specialitate, presă locală), nu după ce cred. Presa locală dă o primă estimare a județului pentru articolele ei. Când în ultimele 6 ore au mers mai puțin de 10 fluxuri, redactorul nu alege niciun subiect: cele rămase ar strâmba alegerea.

## Sincronizarea

Repository-ul site-ului e sursa pentru tot ce e publicat. Tabela `kb` ține o copie a quizurilor, a întrebărilor și a paginilor din wiki, fiecare cu un hash al conținutului: o rulare refăcută fără schimbări nu face nimic, una după o schimbare recalculează doar ce s-a schimbat și șterge ce a dispărut. Sincronizarea rulează după fiecare deploy al redactorului și al site-ului (`POST /sync`) și în fiecare noapte.

## Structura

| | |
|---|---|
| `src/index.ts` | Programul rulărilor și cele trei adrese protejate: `GET /status`, `POST /sync`, `POST /run/<job>` |
| `src/ingest.ts`, `src/feeds.ts`, `src/counties.ts` | Citirea fluxurilor, subiectele, județele din titluri |
| `src/sync.ts`, `src/github.ts` | Copia din repository-ul site-ului, pull request-urile |
| `src/pick.ts`, `src/facts.ts`, `src/draft.ts`, `src/checks.ts`, `src/photo.ts`, `src/newsroom.ts` | De la subiect la pull request |
| `src/vox.ts` | Apelurile către Vox și plafonul zilnic |
| `migrations/` | Tabelele bazei de date (Cloudflare D1, în Uniunea Europeană) |

## Rulare

```sh
npm ci
npx tsc -p .             # tipurile
npx vitest run           # testele
npx wrangler dev --test-scheduled
```

Secretele Worker-ului se pun cu `npx wrangler secret put`: `VOX_API_KEY`, `GITHUB_TOKEN` (citește repository-ul site-ului și deschide pull request-uri în el) și `SYNC_TOKEN`. Local stau în `.dev.vars`. Fiecare push pe `main` verifică, publică și sincronizează ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)); are nevoie de secretele `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` și `SYNC_TOKEN` în repository.
