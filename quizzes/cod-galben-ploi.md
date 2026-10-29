---
title: Cod galben de ploi
summary: București și șapte județe din sud și sud-est sunt sub avertizare de ploi până miercuri la prânz. Cum trece zona ta prin ploile mari.
tags: [vreme]
date: 2026-10-27
counties: [B, IF, TL, CT, CL, IL, GR, TR]
stat: { value: "40 l/mp", label: "de ploaie pot cădea izolat, potrivit ANM" }
image:
  src: /quizzes/cod-galben-ploi.jpg
  alt: O stradă de sat acoperită de apă după o ploaie puternică
  credit: István Szőllősi
  license: CC BY 3.0
  url: https://commons.wikimedia.org/wiki/File:Heavy_Rain_-_panoramio.jpg
  illustrative: true
news:
  - { outlet: G4Media, title: "Cod galben pentru ploi însemnate cantitativ și intensificări ale vântului în București și șapte județe", url: "https://www.g4media.ro/cod-galben-pentru-ploi-insemnate-cantitativ-si-intensificari-ale-vantului-in-bucuresti-si-sapte-judete-precipitatiile-pot-depasi-40-l-mp.html" }
  - { outlet: Informat.ro, title: "ANM a emis cod galben de ploi pentru șapte județe și București, valabil până miercuri la prânz", url: "https://informat.ro/actualitate/anm-cod-galben-ploi-bucuresti-constanta-tulcea-145405" }
  - { outlet: Observator, title: "Ploile pun stăpânire pe sudul țării. Cod galben în București și alte 7 județe", url: "https://observatornews.ro/vremea/ploile-pun-stapanire-pe-sudul-tarii-cod-galben-in-bucuresti-si-alte-7-judete-670428.html" }
questions:
  - id: strazi
    type: scale
    outlook: { "1": -1, "2": -0.5, "3": 0, "4": 0.5, "5": 1 }
    measures: satisfaction
    where: romania
    text: Când plouă mult, cât de bine se scurge apa de pe străzile din localitatea ta?
    scale: { minLabel: Foarte prost, maxLabel: Foarte bine }
  - id: apa-in-casa
    type: single
    outlook: { a: -1, b: -0.5, c: 1 }
    measures: experience
    where: romania
    text: Ți-a intrat vreodată apa în casă, în pivniță sau în curte din cauza ploilor?
    options:
      - { id: a, label: "Da, în ultimele 12 luni" }
      - { id: b, label: "Da, mai demult" }
      - { id: c, label: Niciodată }
  - id: avertizari
    type: multi
    measures: experience
    where: romania
    maxSelect: 3
    text: De unde afli de obicei de avertizările de vreme rea? Alege cel mult trei.
    options:
      - { id: a, label: Din mesajele RO-ALERT pe telefon }
      - { id: b, label: De la televizor sau radio }
      - { id: c, label: De pe site-ul sau aplicația ANM }
      - { id: d, label: De pe rețelele sociale }
      - { id: e, label: De la cei din jur }
      - { id: f, label: Nu urmăresc avertizările }
  - id: pregatit
    type: scale
    outlook: { "1": -1, "2": -0.5, "3": 0, "4": 0.5, "5": 1 }
    measures: expectation
    where: romania
    text: Cât de pregătit(ă) te simți pentru o inundație în zona în care locuiești?
    scale: { minLabel: Deloc pregătit(ă), maxLabel: Foarte pregătit(ă) }
---

- Avertizarea ANM e valabilă de marți, 27 octombrie, de la ora 10, până miercuri, 28 octombrie, la ora 12, pentru București, Ilfov, Tulcea, Constanța, Călărași, Ialomița, Giurgiu și Teleorman.
- Sunt așteptate în general 20–30 l/mp, iar izolat peste 40 l/mp. Călărași și Ialomița au și o avertizare de vânt puternic.
