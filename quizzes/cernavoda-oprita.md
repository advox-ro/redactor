---
title: Iarna fără Cernavodă
summary: Ambele reactoare stau oprite din vară, pentru că Dunărea a scăzut prea mult. Cum îți încălzești casa și cât te îngrijorează factura.
tags: [energie, facturi]
date: 2026-10-27
stat: { value: "20%", label: "din curentul țării vine, de obicei, de la Cernavodă" }
image:
  src: /quizzes/cernavoda-oprita.jpg
  alt: Clădirile reactoarelor de la Centrala Nucleară Cernavodă, în decembrie 2024
  credit: IAEA Imagebank
  license: CC BY 2.0
  url: https://commons.wikimedia.org/wiki/File:Cernavoda_Nuclear_Power_Plant_of_Romania_in_December_2024_on_an_IAEA_IPPAS_mission_to_advise_on_facility_security_-_1.jpg
news:
  - { outlet: Economedia, title: "Un reactor de la Cernavodă ar putea fi repornit în jurul datei de 15 noiembrie", url: "https://economedia.ro/un-reactor-de-la-cernavoda-ar-putea-fi-repornit-in-jurul-datei-de-15-noiembrie.html" }
  - { outlet: Mediafax, title: "Ambele reactoare de la Cernavodă rămân oprite din cauza nivelului Dunării", url: "https://www.mediafax.ro/stirile-zilei/ambele-reactoare-de-la-cernavoda-raman-oprite-din-cauza-nivelului-dunarii-nuclearelectrica-nu-exista-riscuri-pentru-securitatea-nucleara-23823484" }
  - { outlet: Informat.ro, title: "Cristian Bușoi: Reactoarele de la Cernavodă rămân oprite cel puțin zece zile", url: "https://informat.ro/actualitate/cristian-busoi-reactoarele-cernavoda-oprite-sistem-energetic-142986" }
  - { outlet: Ziare.com, title: "Ne așteaptă o iarnă dificilă și costisitoare", url: "https://ziare.com/energie/blocaje-sector-productie-electricitate-cernavoda-iernut-kozlodui-sezon-iarna-2040207" }
questions:
  - id: incalzire
    type: single
    measures: experience
    where: romania
    text: Cu ce îți încălzești în principal locuința în această iarnă?
    options:
      - { id: a, label: "Centrală proprie pe gaz" }
      - { id: b, label: "Termoficare (căldură de la rețeaua orașului)" }
      - { id: c, label: "Lemne" }
      - { id: d, label: "Aparate electrice (calorifer electric, aer condiționat)" }
      - { id: e, label: "Altfel" }
  - id: factura
    type: scale
    outlook: { "1": 1, "2": 0.5, "3": 0, "4": -0.5, "5": -1 }
    measures: expectation
    where: romania
    text: Cât de îngrijorat(ă) ești că factura ta la curent va crește în această iarnă?
    scale: { minLabel: Deloc îngrijorat(ă), maxLabel: Foarte îngrijorat(ă) }
    na: Nu plătesc eu factura la curent
  - id: intreruperi
    type: scale
    outlook: { "1": -1, "2": -0.5, "3": 0, "4": 0.5, "5": 1 }
    measures: trust
    where: romania
    text: Câtă încredere ai că în această iarnă nu vor fi întreruperi de curent în zona ta?
    scale: { minLabel: Deloc, maxLabel: Foarte multă }
  - id: consum
    type: multi
    measures: experience
    where: romania
    maxSelect: 3
    text: Ce faci în această toamnă ca să consumi mai puțin curent? Alege cel mult trei.
    options:
      - { id: a, label: "Sting aparatele pe care nu le folosesc" }
      - { id: b, label: "Folosesc mai rar aparatele mari (mașina de spălat, cuptorul)" }
      - { id: c, label: "Am schimbat becurile cu LED-uri" }
      - { id: d, label: "Încălzesc mai puțin cu aparate electrice" }
      - { id: e, label: "Nimic diferit față de anul trecut" }
---

- Unitatea 1 a fost oprită pe 28 iulie, iar unitatea 2 pe 13 august, pentru că Dunărea scăzuse atât de mult încât nu mai asigura apa de răcire. Nuclearelectrica spune că nu există riscuri pentru securitatea nucleară.
- Ministrul Energiei spune că un reactor ar putea reporni în jurul datei de 15 noiembrie, dacă debitul Dunării continuă să crească.
- Secretarul de stat Cristian Bușoi a spus că nu se așteaptă ca prețul curentului să crească cu mai mult de 20%.
