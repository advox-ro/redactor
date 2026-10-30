# redactor

Redactorul publică conținutul de pe [advox.ro](https://advox.ro): paginile (pe site, quizurile), wiki-ul și fondul de întrebări. Citește presa din România, grupează articolele pe subiecte și le pregătește pentru editor, care scrie pagini noi. Editorul este Vox, inteligența artificială a advox: un agent care pornește în fiecare zi la 05:00 și la 11:00 UTC, după instrucțiunile din [EDITOR.md](EDITOR.md). Fiecare pagină nouă devine un pull request în acest repository, la fel ca schimbările editorului în wiki și în fondul de întrebări; dacă trec verificările de pe GitHub, sunt unite și publicate singure.

## Conținutul

| | |
|---|---|
| [`pages/`](pages/README.md) | Paginile publicate, câte un fișier fiecare, cu fotografiile în `pages/photos/` |
| [`wiki/`](wiki/README.md) | Wiki-ul de la [advox.ro/wiki](https://advox.ro/wiki): cercetarea, cu surse, din care pornesc întrebările |
| [`questions/`](questions/README.md) | Fondul de întrebări, câte un fișier pentru fiecare pagină din wiki, și regulile întrebărilor ([`QUIZ.md`](questions/QUIZ.md)) |

La fiecare deploy, `scripts/content.ts` le include în Worker: paginile, paginile din wiki în HTML, cu procesorul Markdown al site-ului (Sätteri, din Astro; citările `[n]` duc la lista de surse, iar notițele „Idei de întrebări” rămân doar în fișiere) și fondul de întrebări ca `quiz.json`, pe care îl folosește chestionarul de 20 de întrebări (`scripts/pool.mjs`). Merge-ul unui pull request și deploy-ul care urmează le publică. Site-ul le citește de aici la fiecare cerere, printr-un service binding: o legătură directă între cele două Worker-e, fără adresă publică (`Content` în `src/index.ts`).

```sh
npm run validate                  # paginile, după regulile din pages/README.md
node questions/validate.mjs       # fondul de întrebări, după questions/README.md
```

## Cum lucrează

| Când (UTC) | Ce face | Unde |
|---|---|---|
| La 30 de minute | Citește fluxurile de știri, păstrează articolele noi și le pune în subiecte | `src/ingest.ts` |
| 02:00 | Șterge ce e mai vechi de o lună | `src/index.ts` |
| 05:00 și 11:00 (07:00 și 13:00 în România iarna) | Editorul citește candidații, alege, scrie paginile și deschide pull request-urile | [EDITOR.md](EDITOR.md) |
| La fiecare deploy | Publică paginile, wiki-ul și fondul de întrebări | `.github/workflows/deploy.yml` |

- **Subiecte.** Fiecare articol primește un vector (embedding, modelul bge-m3) din titlu și primele rânduri. Un articol intră într-un subiect deschis dacă e destul de apropiat de el (`JOIN` în `src/ingest.ts`), altfel începe unul nou. Un subiect rămâne deschis 72 de ore de la ultimul articol. Un articol preluat aproape identic de la altă publicație nu se numără ca a doua sursă.
- **Candidații.** `GET /candidates` dă subiectele din ultima zi care ar putea deveni o pagină, ordonate după ce poate măsura codul: câte tipuri de publicații scriu despre subiect și dacă subiectul crește. Pentru fiecare: articolele și județele (`src/candidates.ts`). Judecata (ce fel de știre e, câți oameni atinge, dacă se pot pune întrebări fără vinovați și fără partide, dacă advox.ro a mai întrebat despre el) e a editorului, care citește paginile, fondul de întrebări și wiki-ul direct din repository.
- **Verificarea paginii.** O pagină din știri își are dovezile în fișierul ei: sub fiecare fapt, propozițiile din articole pe care se sprijină, cu numărul articolului din lista „Surse” (`pages/README.md`). Editorul trebuie să treacă `npm run check-page` înainte să-l propună, iar GitHub o rulează din nou pe pull request (`.github/workflows/check.yml`). Comanda descarcă fiecare articol și verifică faptul că fiecare propoziție citată apare în articol cuvânt cu cuvânt, că fiecare număr din fapte se află în citatele lor și fiecare număr din rezumat și cifra-cheie într-un citat al paginii, că faptele vin de la cel puțin două publicații și, la o pagină pentru toată țara, de la două tipuri de publicații (`src/pagecheck.ts`). Apoi trebuie să treacă și `npm run validate`.
- **Publicarea.** Editorul lucrează într-un mediu din care GitHub se poate doar citi, așa că trimite pagina redactorului (`POST /proposals`, cu `scripts/propose.mjs`). Worker-ul o pune pe ramura `page/<slug>` și deschide pull request-ul în numele contului advox-ro, cu secretul `GITHUB_TOKEN`. La fel cu schimbările din wiki și din fondul de întrebări, pe o ramură `content/<slug>`. Worker-ul poate atinge doar aceste ramuri și doar aceste fișiere: cele două ale paginii (pagina și fotografia), paginile din `wiki/` și fișierele `.jsonl` din `questions/`, nu și README-urile sau `QUIZ.md` (`src/proposals.ts`). Un astfel de pull request se unește singur când toate verificările trec, apoi deploy-ul îl publică. O întrebare deja publicată, din fond sau dintr-o pagină, trebuie să întrebe la fel ca înainte: același text, aceleași variante, în aceeași ordine. Răspunsurile sunt păstrate după `id` și după litera variantei (`scripts/questions-unchanged.ts`, la fiecare pull request). Unul care nu trece rămâne deschis, cu motivul în log. Orice altă schimbare în repository se unește de mână.
- **Deciziile.** Editorul trimite înapoi ce a decis despre fiecare candidat citit, cu motivul (`POST /decisions`). Un subiect cu o decizie nu mai e oferit.

## Sursele

Fluxurile sunt în [`src/sources.ts`](src/sources.ts), verificate unul câte unul. Publicațiile sunt grupate după ce sunt (radio și televiziune publică, agenții, televiziuni, ziare și site-uri, presă economică, presă de investigație, presă de specialitate, presă locală), nu după ce cred. Presa locală dă o primă estimare a județului pentru articolele ei.

## Structura

| | |
|---|---|
| `pages/`, `wiki/`, `questions/` | Conținutul publicat, regulile și verificarea lui |
| `src/pagefile.ts`, `scripts/content.ts`, `scripts/pool.mjs`, `scripts/citations.mjs`, `scripts/private-sections.mjs`, `src/content.ts` | Cum ajunge conținutul în Worker |
| `src/index.ts` | Programul rulărilor, entrypoint-ul `Content` pentru site și adresele, toate cu `REDACTOR_TOKEN`: `GET /candidates`, `POST /decisions`, `GET /status`, `POST /run/<job>`, `/proposals`, `GET /commons` |
| `src/ingest.ts`, `src/feeds.ts`, `src/counties.ts`, `src/sources.ts` | Fluxurile, subiectele, județele din titluri |
| `src/candidates.ts` | Candidații zilei și deciziile editorului |
| `src/commons.ts` | Fotografiile de pe Wikimedia Commons, căutate și descărcate pentru editor |
| `src/proposals.ts`, `scripts/propose.mjs`, `scripts/await-pr.mjs` | Pull request-urile editorului, deschise de Worker în numele contului advox-ro |
| `src/pagecheck.ts`, `src/facts.ts`, `scripts/check-page.ts` | Verificarea unei pagini față de articolele ei |
| `EDITOR.md` | Instrucțiunile editorului |
| `migrations/` | Tabelele bazei de date (Cloudflare D1, în Uniunea Europeană) |

## Rulare

```sh
npm ci
npm run check            # tipurile
npm test                 # testele
npm run dev              # Worker-ul local, cu rulările programate
```

Secretele Worker-ului, puse cu `npx wrangler secret put`: `REDACTOR_TOKEN`, cerut de toate adresele, și `GITHUB_TOKEN`, un token al contului advox-ro doar pentru acest repository, cu drept de scriere pe conținut și pe pull request-uri; local stau în `.dev.vars`. Fiecare push pe `main` verifică și publică ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)); are nevoie de secretele `CLOUDFLARE_API_TOKEN` și `CLOUDFLARE_ACCOUNT_ID` în repository.
