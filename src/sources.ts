// The feeds redactor reads, all checked by hand. kind groups outlets by what they are, not by
// what they think: a quiz from the news needs its facts from two outlets, and a national quiz from
// two kinds of outlets. A local outlet gives its county as a first guess for its articles.
export type Kind = 'public' | 'agency' | 'tv' | 'press' | 'business' | 'investigative' | 'specialist' | 'local';
export type Feed = { id: string; outlet: string; url: string; kind: Kind; county?: string };

export const FEEDS: Feed[] = [
  // Public broadcasters and agencies.
  { id: 'rra', outlet: 'Radio România Actualități', url: 'https://www.romania-actualitati.ro/rss', kind: 'public' },
  { id: 'tvrinfo', outlet: 'TVR Info', url: 'https://tvrinfo.ro/feed/', kind: 'public' },
  { id: 'dw', outlet: 'DW Română', url: 'https://rss.dw.com/rdf/rss-rom-all', kind: 'public' },
  { id: 'newsro', outlet: 'News.ro', url: 'https://www.news.ro/rss', kind: 'agency' },
  { id: 'mediafax', outlet: 'Mediafax', url: 'https://www.mediafax.ro/feed', kind: 'agency' },
  // Television newsrooms.
  { id: 'digi24', outlet: 'Digi24', url: 'https://www.digi24.ro/rss', kind: 'tv' },
  { id: 'protv', outlet: 'Știrile ProTV', url: 'https://stirileprotv.ro/rss/', kind: 'tv' },
  { id: 'observator', outlet: 'Observator', url: 'https://observatornews.ro/rss', kind: 'tv' },
  { id: 'antena3', outlet: 'Antena 3 CNN', url: 'https://www.antena3.ro/rss', kind: 'tv' },
  { id: 'romaniatv', outlet: 'România TV', url: 'https://www.romaniatv.net/feed', kind: 'tv' },
  { id: 'b1tv', outlet: 'B1 TV', url: 'https://www.b1tv.ro/feed/', kind: 'tv' },
  { id: 'realitatea', outlet: 'Realitatea', url: 'https://www.realitatea.net/rss', kind: 'tv' },
  // Newspapers and news sites.
  { id: 'adevarul', outlet: 'Adevărul', url: 'https://adevarul.ro/rss/index', kind: 'press' },
  { id: 'libertatea', outlet: 'Libertatea', url: 'https://www.libertatea.ro/feed', kind: 'press' },
  { id: 'hotnews', outlet: 'HotNews', url: 'https://hotnews.ro/feed', kind: 'press' },
  { id: 'g4media', outlet: 'G4Media', url: 'https://www.g4media.ro/feed', kind: 'press' },
  { id: 'ziare', outlet: 'Ziare.com', url: 'https://ziare.com/rss/stiri.xml', kind: 'press' },
  { id: 'gandul', outlet: 'Gândul', url: 'https://www.gandul.ro/feed', kind: 'press' },
  { id: 'spotmedia', outlet: 'Spotmedia', url: 'https://spotmedia.ro/feed', kind: 'press' },
  { id: 'stiripesurse', outlet: 'Știri pe surse', url: 'https://www.stiripesurse.ro/rss/stiri.xml', kind: 'press' },
  { id: 'dcnews', outlet: 'DC News', url: 'https://www.dcnews.ro/rss', kind: 'press' },
  { id: 'cotidianul', outlet: 'Cotidianul', url: 'https://www.cotidianul.ro/feed/', kind: 'press' },
  // Business, investigations and specialist outlets.
  { id: 'economedia', outlet: 'Economedia', url: 'https://economedia.ro/feed', kind: 'business' },
  { id: 'profit', outlet: 'Profit.ro', url: 'https://www.profit.ro/rss', kind: 'business' },
  { id: 'zf', outlet: 'Ziarul Financiar', url: 'https://www.zf.ro/rss/', kind: 'business' },
  { id: 'recorder', outlet: 'Recorder', url: 'https://recorder.ro/feed/', kind: 'investigative' },
  { id: 'pressone', outlet: 'PressOne', url: 'https://pressone.ro/feed', kind: 'investigative' },
  { id: 'edupedu', outlet: 'Edupedu', url: 'https://www.edupedu.ro/feed/', kind: 'specialist' },
  // Local outlets, with their county.
  { id: 'monitorulcj', outlet: 'Monitorul de Cluj', url: 'https://www.monitorulcj.ro/rss', kind: 'local', county: 'CJ' },
  { id: 'faclia', outlet: 'Ziarul Făclia', url: 'https://ziarulfaclia.ro/feed/', kind: 'local', county: 'CJ' },
  { id: 'radiocluj', outlet: 'Radio Cluj', url: 'https://www.radiocluj.ro/feed/', kind: 'local', county: 'CJ' },
  { id: 'ziaruldeiasi', outlet: 'Ziarul de Iași', url: 'https://www.ziaruldeiasi.ro/rss', kind: 'local', county: 'IS' },
  { id: 'bzi', outlet: 'Bună Ziua Iași', url: 'https://www.bzi.ro/rss', kind: 'local', county: 'IS' },
  { id: 'gds', outlet: 'Gazeta de Sud', url: 'https://www.gds.ro/feed/', kind: 'local', county: 'DJ' },
  { id: 'ctnews', outlet: 'CTnews', url: 'https://www.ctnews.ro/feed', kind: 'local', county: 'CT' },
  { id: 'bihoreanul', outlet: 'Bihoreanul', url: 'https://www.ebihoreanul.ro/rss', kind: 'local', county: 'BH' },
  { id: 'banatulazi', outlet: 'Banatul Azi', url: 'https://www.banatulazi.ro/feed/', kind: 'local', county: 'TM' },
  { id: 'opiniatm', outlet: 'Opinia Timișoarei', url: 'https://www.opiniatimisoarei.ro/feed', kind: 'local', county: 'TM' },
  { id: 'tion', outlet: 'Tion', url: 'https://www.tion.ro/feed/', kind: 'local', county: 'TM' },
  { id: 'monitorulexpres', outlet: 'Monitorul Expres', url: 'https://www.monitorulexpres.ro/feed/', kind: 'local', county: 'BV' },
  { id: 'newsbv', outlet: 'NewsBV', url: 'https://newsbv.ro/feed/', kind: 'local', county: 'BV' },
  { id: 'mytex', outlet: 'MyTex', url: 'https://mytex.ro/feed/', kind: 'local', county: 'BV' },
  { id: 'unirea', outlet: 'Ziarul Unirea', url: 'https://ziarulunirea.ro/feed/', kind: 'local', county: 'AB' },
  { id: 'gazetanv', outlet: 'Gazeta de Nord-Vest', url: 'https://www.gazetanord-vest.ro/feed/', kind: 'local', county: 'SM' },
  { id: 'obiectivbr', outlet: 'Obiectiv Brăila', url: 'https://obiectivbr.ro/feed/', kind: 'local', county: 'BR' },
  { id: 'b365', outlet: 'B365', url: 'https://b365.ro/feed/', kind: 'local', county: 'B' },
  { id: 'radiomures', outlet: 'Radio Mureș', url: 'https://www.radiomures.ro/feed', kind: 'local', county: 'MS' },
  { id: 'magazinsalajean', outlet: 'Magazin Sălăjean', url: 'https://www.magazinsalajean.ro/feed/', kind: 'local', county: 'SJ' },
  { id: 'monitoruldevrancea', outlet: 'Monitorul de Vrancea', url: 'https://www.monitoruldevrancea.ro/feed/', kind: 'local', county: 'VN' },
  { id: 'ziaruldelta', outlet: 'Ziarul Delta', url: 'https://ziaruldelta.ro/feed/', kind: 'local', county: 'TL' },
  { id: 'actualmehedinti', outlet: 'Actual Mehedinți', url: 'https://www.actualmehedinti.ro/feed/', kind: 'local', county: 'MH' },
  { id: 'jurnalgiurgiuvean', outlet: 'Jurnal Giurgiuvean', url: 'https://jurnalgiurgiuvean.ro/feed/', kind: 'local', county: 'GR' },
  { id: 'informatiahr', outlet: 'Informația Harghitei', url: 'https://informatiahr.ro/feed/', kind: 'local', county: 'HR' },
  { id: 'liberinteleorman', outlet: 'Liber în Teleorman', url: 'https://liberinteleorman.ro/feed/', kind: 'local', county: 'TR' },
];

/** The kind of each outlet, by its name as stored with the articles. */
export const BUCKET_OF: Record<string, Kind> = Object.fromEntries(FEEDS.map((f) => [f.outlet, f.kind]));

export const isLocalOutlet = (outlet: string) => BUCKET_OF[outlet] === 'local';
