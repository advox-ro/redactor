-- redactor's working memory: what the press published, grouped into stories, and what was drafted
-- from them. D1 database "redactor", created with --jurisdiction=eu.

-- One row per article seen in a feed. The address is the identity: an article is stored once.
-- emb: the bge-m3 embedding of "title. lede" (1024 float32). dup_of: an article from another outlet
-- that this one copies (agency copy republished), so it doesn't count as a second source.
CREATE TABLE articles (
  id INTEGER PRIMARY KEY,
  feed TEXT NOT NULL,
  outlet TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  lede TEXT NOT NULL,
  published_at INTEGER,
  fetched_at INTEGER NOT NULL,
  counties TEXT NOT NULL DEFAULT '[]',
  emb BLOB,
  dup_of INTEGER REFERENCES articles(id),
  story_id INTEGER REFERENCES stories(id)
);
CREATE INDEX articles_new ON articles(emb) WHERE emb IS NULL;
CREATE INDEX articles_story ON articles(story_id);
CREATE INDEX articles_time ON articles(fetched_at);

-- A story: the articles about one event, across outlets. centroid: the mean of its articles'
-- embeddings (fixed once it has 30). A story stays open while articles keep coming (72 hours).
CREATE TABLE stories (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  centroid BLOB NOT NULL,
  n_articles INTEGER NOT NULL DEFAULT 0,
  outlets TEXT NOT NULL DEFAULT '[]',
  counties TEXT NOT NULL DEFAULT '{}',
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  quiz_slug TEXT
);
CREATE INDEX stories_open ON stories(last_seen);

-- The daily choice of stories: the model's reading of each candidate and the score it got.
-- decision: keep | drop; scope: national, or the counties of a local story (JSON).
CREATE TABLE picks (
  story_id INTEGER NOT NULL REFERENCES stories(id),
  day TEXT NOT NULL,
  category TEXT,
  impact REAL,
  answerable REAL,
  diversity REAL,
  novelty REAL,
  momentum REAL,
  score REAL,
  decision TEXT NOT NULL,
  scope TEXT,
  angle TEXT,
  reason TEXT,
  PRIMARY KEY (story_id, day)
);

-- What a story's articles state, each claim with the sentence it comes from, word for word.
-- verified: the quote was found in the fetched article and every number in the claim is in it.
CREATE TABLE claims (
  id INTEGER PRIMARY KEY,
  story_id INTEGER NOT NULL REFERENCES stories(id),
  article_id INTEGER NOT NULL REFERENCES articles(id),
  text TEXT NOT NULL,
  quote TEXT NOT NULL,
  verified INTEGER NOT NULL
);
CREATE INDEX claims_story ON claims(story_id);

-- A drafted quiz. status: drafted | failed | pr_open | merged | closed. report: what the checks found.
CREATE TABLE drafts (
  id INTEGER PRIMARY KEY,
  story_id INTEGER REFERENCES stories(id),
  slug TEXT NOT NULL,
  md TEXT,
  report TEXT,
  status TEXT NOT NULL,
  pr_url TEXT,
  cost_usd REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- A copy of the site repository's knowledge, kept in step with it by the sync job (sync.ts): the
-- quizzes already published (kind "quiz", from sets/), the question pool ("question") and the wiki
-- pages ("wiki").
-- The repository is the source; a row changes only when its file's content changed (hash), and a
-- row whose file is gone is deleted. meta: what each kind needs besides the text (JSON).
CREATE TABLE kb (
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  hash TEXT NOT NULL,
  emb BLOB NOT NULL,
  synced_at INTEGER NOT NULL,
  PRIMARY KEY (kind, key)
);

-- Official figures, one row per series and period (an exchange rate per day, inflation per month).
CREATE TABLE indicators (
  series TEXT NOT NULL,
  period TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  source TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (series, period)
);

-- Feed health: a feed that keeps failing is reported, and too few working feeds stops the day's run.
CREATE TABLE feeds (
  id TEXT PRIMARY KEY,
  last_ok_at INTEGER,
  fail_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

-- Every job run and what the model calls cost, checked against the daily cap before each call.
CREATE TABLE runs (
  id INTEGER PRIMARY KEY,
  job TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT NOT NULL,
  detail TEXT,
  cost_usd REAL NOT NULL DEFAULT 0
);
CREATE INDEX runs_time ON runs(started_at);
