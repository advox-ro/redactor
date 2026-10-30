---
title: Cernavodă rămâne oprită
summary: Reactoarele de la Cernavodă rămân oprite și în noiembrie. Cum îți încălzești casa și cât te îngrijorează factura.
tags: [energie, facturi]
date: 2026-10-29
stat: { value: "20%", label: "din curentul produs în țară vine, de obicei, de la Cernavodă" }
image:
  src: /quizzes/cernavoda-oprita.jpg
  alt: Clădirile reactoarelor de la Centrala Nucleară Cernavodă, în decembrie 2024
  credit: IAEA Imagebank
  license: CC BY 2.0
  url: https://commons.wikimedia.org/wiki/File:Cernavoda_Nuclear_Power_Plant_of_Romania_in_December_2024_on_an_IAEA_IPPAS_mission_to_advise_on_facility_security_-_1.jpg
news:
  - { outlet: Digi24, title: "Starea de alertă la Centrala de la Cernavodă a fost prelungită: reactoarele 1 și 2 rămân oprite și în noiembrie", url: "https://www.digi24.ro/stiri/economie/energie/starea-de-alerta-la-centrala-de-la-cernavoda-a-fost-prelungita-reactoarele-1-si-2-nu-repornesc-nici-in-noiembrie-4014105" }
  - { outlet: Mediafax, title: "Ambele reactoare de la Cernavodă rămân oprite din cauza nivelului Dunării", url: "https://www.mediafax.ro/stirile-zilei/ambele-reactoare-de-la-cernavoda-raman-oprite-din-cauza-nivelului-dunarii-nuclearelectrica-nu-exista-riscuri-pentru-securitatea-nucleara-23823484" }
  - { outlet: Mediafax, title: "Nuclearelectrica: Centrala de la Cernavodă rămâne, momentan, oprită în stare sigură", url: "https://www.mediafax.ro/economic/nuclearelectrica-centrala-de-la-cernavoda-ramane-momentan-oprita-in-stare-sigura-pe-fondul-unor-prognoze-inca-volatile-si-nesustenabile-23834061" }
  - { outlet: Ziarul Financiar, title: "Criza de la Cernavodă se prelungește cu încă o lună, prețul energiei spot frige", url: "https://www.zf.ro/companii/criza-de-la-cernavoda-se-prelungeste-cu-inca-o-luna-pretul-energiei-spot-frige-transelectrica-are-mana-libera-sa-taie-din-consum-daca-productia-nu-ajunge-23270647" }
  - { outlet: Cotidianul, title: "Guvernul menține starea de alertă în energie. Cotele scăzute ale Dunării țin oprite reactoarele de la Cernavodă și în noiembrie", url: "https://www.cotidianul.ro/guvernul-mentine-starea-de-alerta-in-energie-cotele-scazute-ale-dunarii-tin-oprite-reactoarele-de-la-cernavoda-si-in-noimebrie/" }
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

- Unitatea 1 a fost oprită pe 28 iulie, iar unitatea 2 pe 13 august, pentru că Dunărea scăzuse prea mult pentru apa de răcire. Nuclearelectrica spune că situația nu prezintă niciun risc pentru securitatea nucleară.
- Pe 29 octombrie, Comitetul Național pentru Situații de Urgență a prelungit cu 30 de zile starea de alertă în energie, a treia prelungire de la finalul lui iulie, pentru că reactoarele nu pot fi repornite în noiembrie. Ministrul Energiei a spus că, pe baza prognozelor actuale, un reactor ar putea reporni în jurul datei de 15 noiembrie; Nuclearelectrica a transmis joi seară că prognozele nu îndeplinesc încă toate criteriile pentru repornire.
- Hotărârea le cere celor de la Transelectrica să ia toate măsurile pentru a evita o pană majoră de curent: mai multă producție în țară, importuri din țările vecine și, la nevoie, reducerea consumului. Pe piața spot, România a fost printre cele mai scumpe piețe din Europa, cu o medie de 323 de euro pe MWh, apoi de 258 de euro pe MWh.
