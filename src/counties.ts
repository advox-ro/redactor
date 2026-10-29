// The counties, with the codes advox.ro uses (web/src/data/counties.ts in the site) and the towns
// that point to them in a headline. DSP is the diaspora, as in the site's sets.
// loose: the county's name is also a common word ("alba"), so only "județul Alba" and its towns count.
export type County = { code: string; name: string; towns: string[]; loose?: boolean };

export const COUNTIES: County[] = [
  { code: 'AB', name: 'Alba', towns: ['Alba Iulia', 'Aiud', 'Blaj', 'Sebeș'], loose: true },
  { code: 'AR', name: 'Arad', towns: ['Arad'] },
  { code: 'AG', name: 'Argeș', towns: ['Pitești', 'Câmpulung', 'Curtea de Argeș', 'Mioveni'] },
  { code: 'BC', name: 'Bacău', towns: ['Bacău', 'Onești', 'Moinești'] },
  { code: 'BH', name: 'Bihor', towns: ['Oradea', 'Salonta', 'Beiuș'] },
  { code: 'BN', name: 'Bistrița-Năsăud', towns: ['Bistrița', 'Năsăud'] },
  { code: 'BT', name: 'Botoșani', towns: ['Botoșani', 'Dorohoi'] },
  { code: 'BR', name: 'Brăila', towns: ['Brăila'] },
  { code: 'BV', name: 'Brașov', towns: ['Brașov', 'Făgăraș', 'Codlea', 'Săcele'] },
  { code: 'B', name: 'București', towns: ['București', 'Capitală', 'Capitalei'] },
  { code: 'BZ', name: 'Buzău', towns: ['Buzău', 'Râmnicu Sărat'] },
  { code: 'CL', name: 'Călărași', towns: ['Călărași', 'Oltenița'] },
  { code: 'CS', name: 'Caraș-Severin', towns: ['Reșița', 'Caransebeș'] },
  { code: 'CJ', name: 'Cluj', towns: ['Cluj-Napoca', 'Turda', 'Dej', 'Câmpia Turzii'] },
  { code: 'CT', name: 'Constanța', towns: ['Constanța', 'Mangalia', 'Medgidia', 'Cernavodă', 'Mamaia'] },
  { code: 'CV', name: 'Covasna', towns: ['Sfântu Gheorghe', 'Târgu Secuiesc'] },
  { code: 'DB', name: 'Dâmbovița', towns: ['Târgoviște', 'Moreni'] },
  { code: 'DJ', name: 'Dolj', towns: ['Craiova', 'Calafat', 'Băilești'] },
  { code: 'GL', name: 'Galați', towns: ['Galați', 'Tecuci'] },
  { code: 'GR', name: 'Giurgiu', towns: ['Giurgiu'] },
  { code: 'GJ', name: 'Gorj', towns: ['Târgu Jiu', 'Motru', 'Rovinari'] },
  { code: 'HR', name: 'Harghita', towns: ['Miercurea Ciuc', 'Odorheiu Secuiesc', 'Gheorgheni'] },
  { code: 'HD', name: 'Hunedoara', towns: ['Deva', 'Hunedoara', 'Petroșani', 'Orăștie'] },
  { code: 'IL', name: 'Ialomița', towns: ['Slobozia', 'Fetești', 'Urziceni'] },
  { code: 'IS', name: 'Iași', towns: ['Iași', 'Pașcani'] },
  { code: 'IF', name: 'Ilfov', towns: ['Otopeni', 'Voluntari', 'Buftea', 'Popești-Leordeni', 'Chiajna'] },
  { code: 'MM', name: 'Maramureș', towns: ['Baia Mare', 'Sighetu Marmației'] },
  { code: 'MH', name: 'Mehedinți', towns: ['Drobeta-Turnu Severin', 'Orșova'] },
  { code: 'MS', name: 'Mureș', towns: ['Târgu Mureș', 'Reghin', 'Sighișoara'] },
  { code: 'NT', name: 'Neamț', towns: ['Piatra Neamț'] },
  { code: 'OT', name: 'Olt', towns: ['Slatina', 'Caracal'] },
  { code: 'PH', name: 'Prahova', towns: ['Ploiești', 'Câmpina', 'Sinaia', 'Bușteni'] },
  { code: 'SJ', name: 'Sălaj', towns: ['Zalău'] },
  { code: 'SM', name: 'Satu Mare', towns: ['Satu Mare', 'Carei'] },
  { code: 'SB', name: 'Sibiu', towns: ['Sibiu', 'Mediaș'] },
  { code: 'SV', name: 'Suceava', towns: ['Suceava', 'Fălticeni', 'Rădăuți', 'Câmpulung Moldovenesc'] },
  { code: 'TR', name: 'Teleorman', towns: ['Alexandria', 'Roșiorii de Vede', 'Turnu Măgurele'] },
  { code: 'TM', name: 'Timiș', towns: ['Timișoara', 'Lugoj'] },
  { code: 'TL', name: 'Tulcea', towns: ['Tulcea', 'Sulina'] },
  { code: 'VL', name: 'Vâlcea', towns: ['Râmnicu Vâlcea', 'Drăgășani'] },
  { code: 'VS', name: 'Vaslui', towns: ['Vaslui', 'Bârlad', 'Huși'] },
  { code: 'VN', name: 'Vrancea', towns: ['Focșani', 'Adjud'] },
];

export const CODES = new Set([...COUNTIES.map((c) => c.code), 'DSP']);

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Whole words, with the endings Romanian adds to a place name ("Clujului", "clujeni"): "Dej" counts,
// "deja" doesn't.
const ENDINGS = '(ul|ului|ean|eana|eni|ene|enii|ence)?';
const PATTERNS = COUNTIES.map((c) => ({
  code: c.code,
  re: new RegExp(
    `(^|[^\\p{L}])(${[`judetul ${c.name}`, ...(c.loose ? [] : [c.name]), ...c.towns].map((n) => fold(n).replace(/[-\s]/g, '[-\\s]')).join('|')})${ENDINGS}(?![\\p{L}])`,
    'u',
  ),
}));

/** The counties a headline or summary names, by county or town. A guess, refined by the story's
 *  articles taken together (ingest.ts) and by Vox when it picks a local story (pick.ts). */
export function countiesIn(text: string): string[] {
  const t = fold(text);
  return PATTERNS.filter((p) => p.re.test(t)).map((p) => p.code);
}
