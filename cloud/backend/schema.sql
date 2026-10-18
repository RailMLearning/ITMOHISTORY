CREATE TABLE IF NOT EXISTS chunks (id TEXT PRIMARY KEY, character TEXT NOT NULL, text TEXT NOT NULL, metadata TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS chunks_character ON chunks(character);
CREATE VIRTUAL TABLE IF NOT EXISTS chunk_terms USING fts5(id UNINDEXED, character UNINDEXED, terms, tokenize='unicode61');
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
