### Balconul locuinței în care stai este închis?

| id | balcon-inchis |
|---|---|
| type | single |
| measures | experience |
| na | Locuința mea nu are balcon |

1. Da, l-am închis eu sau un proprietar dinainte
2. Da, a fost închis când s-a reabilitat blocul
3. Nu
4. Nu știu

### Ai autorizație pentru închiderea balconului?

| id | autorizatie |
|---|---|
| type | single |
| measures | experience |
| where | romania |
| na | Balconul meu nu e închis |

1. Da
2. Nu
3. Nu știu

### Cât de îngrijorat(ă) ești că ai putea plăti o amendă sau un impozit mai mare pentru balconul închis?

| id | ingrijorare-amenda |
|---|---|
| type | scale |
| measures | expectation |
| where | romania |
| scale | Deloc îngrijorat(ă) … Foarte îngrijorat(ă) |
| na | Balconul meu nu e închis |
| outlook | 1: 1, 2: 0.5, 3: 0, 4: -0.5, 5: -1 |

### Dacă ar trebui să faci actele pentru o lucrare la locuință, cât de ușor crezi că ți-ar fi la primăria ta?

| id | acte-primarie |
|---|---|
| type | scale |
| measures | expectation |
| where | romania |
| scale | Foarte greu … Foarte ușor |
| outlook | 1: -1, 2: -0.5, 3: 0, 4: 0.5, 5: 1 |

### Ce ar trebui să facă statul cu balcoanele închise fără autorizație?

| id | ce-sa-faca |
|---|---|
| type | single |
| measures | opinion |

1. Să le legalizeze fără plată
2. Să le legalizeze cu o taxă mică
3. Să ceară proiect de la arhitect și aprobarea primăriei
4. Să dea amenzi celor care nu fac actele
5. Nu știu
