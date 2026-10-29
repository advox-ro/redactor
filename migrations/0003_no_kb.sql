-- The editor reads the quizzes, the question pool and the wiki from the repository itself, so the
-- Worker keeps no copy of them. A story counts as covered once the editor has decided about it
-- (decisions), so stories need no quiz_slug either. Embeddings stay only for grouping articles.
DROP TABLE kb;
ALTER TABLE stories DROP COLUMN quiz_slug;
