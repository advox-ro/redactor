-- The choosing and writing moved to the editor, a scheduled agent (EDITOR.md): the
-- Worker keeps the news, the stories and the knowledge base, and records what the editor decided.
DROP TABLE claims;
DROP TABLE picks;
DROP TABLE drafts;
DROP TABLE runs;

-- What the editor decided about a story, and why. decision: keep (a quiz was proposed: its slug
-- and pull request) or drop. A story with a decision is not offered again.
CREATE TABLE decisions (
  story_id INTEGER NOT NULL REFERENCES stories(id),
  day TEXT NOT NULL,
  decision TEXT NOT NULL,
  scope TEXT,
  reason TEXT NOT NULL,
  slug TEXT,
  pr_url TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (story_id, day)
);

-- Every job run and its result.
CREATE TABLE runs (
  id INTEGER PRIMARY KEY,
  job TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX runs_time ON runs(started_at);
