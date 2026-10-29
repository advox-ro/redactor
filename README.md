# redactor

Redactorul publică quizurile de pe [advox.ro](https://advox.ro). Citește presa din România, grupează articolele pe subiecte și le pregătește pentru editor, care propune quizuri noi. Editorul este Vox, inteligența artificială a advox: un agent care pornește în fiecare dimineață după instrucțiunile din [EDITOR.md](EDITOR.md). Fiecare propunere devine un pull request în acest repository, iar un om o citește și decide dacă se publică.

## Quizurile

Quizurile publicate sunt în [`quizzes/`](quizzes/README.md), câte un fișier fiecare, cu fotografiile în `quizzes/photos/`. La fiecare deploy sunt incluse în Worker (`scripts/content.ts`), așa că merge-ul unui pull request și deploy-ul care urmează le publică. Site-ul le citește de aici la fiecare cerere, printr-un service binding: o legătură directă între cele două Worker-e, fără adresă publică (`Content` în `src/index.ts`). `npm run validate` verifică toate quizurile după regulile din `quizzes/README.md`.

## Cum lucrează

| Când (UTC) | Ce face | Unde |
|---|---|---|
| La 30 de minute | Citește fluxurile de știri, păstrează articolele noi și le pune în subiecte, apoi sincronizează copia | `src/ingest.ts`, `src/sync.ts` |
| 02:00 | Șterge ce e mai vechi de o lună | `src/index.ts` |
| Dimineața | Editorul citește candidații, alege, scrie quizurile și deschide pull request-urile | [EDITOR.md](EDITOR.md) |
| La fiecare deploy | Publică quizurile din `quizzes/` și sincronizează copia | `.github/workflows/deploy.yml` |

- **Subiecte.** Fiecare articol primește un vector (embedding, modelul bge-m3) din titlu și primele rânduri. Un articol intră într-un subiect deschis dacă e destul de apropiat de el (`JOIN` în `src/ingest.ts`), altfel începe unul nou. Un subiect rămâne deschis 72 de ore de la ultimul articol. Un articol preluat aproape identic de la altă publicație nu se numără ca a doua sursă.
- **Candidații.** `GET /candidates` dă subiectele din ultima zi care ar putea deveni un quiz, ordonate după ce poate măsura codul: câte tipuri de publicații scriu despre subiect, dacă advox.ro a mai întrebat despre el și dacă subiectul crește. Pentru fiecare: articolele, județele, quizul publicat cel mai apropiat și întrebările din fondul de întrebări cele mai apropiate (`src/candidates.ts`). Judecata (ce fel de știre e, câți oameni atinge, dacă se pot pune întrebări fără vinovați și fără partide) e a editorului.
- **Verificarea quizului.** Înainte să propună un quiz, editorul trebuie să treacă `npm run check-quiz`. Comanda descarcă fiecare articol citat și verifică faptul că propoziția pe care se sprijină fiecare fapt apare în articol cuvânt cu cuvânt, că fiecare număr din fapte, rezumat și cifra-cheie se află în propozițiile citate, că faptele vin de la cel puțin două publicații și, la un quiz pentru toată țara, de la două tipuri de publicații (`src/quizcheck.ts`). Apoi trebuie să treacă și `npm run validate`.
- **Deciziile.** Editorul trimite înapoi ce a decis despre fiecare candidat citit, cu motivul (`POST /decisions`). Un subiect cu o decizie nu mai e oferit.

## Sursele

Fluxurile sunt în [`src/sources.ts`](src/sources.ts), verificate unul câte unul. Publicațiile sunt grupate după ce sunt (radio și televiziune publică, agenții, televiziuni, ziare și site-uri, presă economică, presă de investigație, presă de specialitate, presă locală), nu după ce cred. Presa locală dă o primă estimare a județului pentru articolele ei.

## Sincronizarea

Tabela `kb` ține o copie a quizurilor publicate și, din repository-ul site-ului, a fondului de întrebări, a paginilor din wiki și a regulilor pentru întrebări, fiecare cu un hash al conținutului: o rulare fără schimbări nu face nimic, una după o schimbare recalculează doar ce s-a schimbat și șterge ce a dispărut. Sincronizarea rulează după fiecare deploy (`POST /sync`) și la fiecare 30 de minute.

## Structura

| | |
|---|---|
| `quizzes/`, `scripts/content.ts`, `src/content.ts` | Quizurile publicate, regulile și verificarea lor, și cum ajung în Worker |
| `src/index.ts` | Programul rulărilor, entrypoint-ul `Content` pentru site și adresele, toate cu `REDACTOR_TOKEN`: `GET /candidates`, `POST /decisions`, `POST /sync`, `GET /kb`, `GET /status`, `POST /run/<job>` |
| `src/ingest.ts`, `src/feeds.ts`, `src/counties.ts`, `src/sources.ts` | Fluxurile, subiectele, județele din titluri |
| `src/candidates.ts` | Candidații zilei și deciziile editorului |
| `src/sync.ts`, `src/github.ts` | Copia quizurilor și a celor din repository-ul site-ului |
| `src/quizcheck.ts`, `src/facts.ts`, `scripts/check-quiz.ts` | Verificarea unui quiz față de articolele lui |
| `EDITOR.md` | Instrucțiunile editorului |
| `migrations/` | Tabelele bazei de date (Cloudflare D1, în Uniunea Europeană) |

## Rulare

```sh
npm ci
npm run check            # tipurile
npm test                 # testele
npm run dev              # Worker-ul local, cu rulările programate
```

Secretele Worker-ului se pun cu `npx wrangler secret put`: `GITHUB_TOKEN` (citește repository-ul site-ului) și `REDACTOR_TOKEN`. Local stau în `.dev.vars`. Fiecare push pe `main` verifică, publică și sincronizează ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)); are nevoie de secretele `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` și `REDACTOR_TOKEN` în repository.
