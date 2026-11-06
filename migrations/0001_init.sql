CREATE TABLE drawings (
	id TEXT PRIMARY KEY,
	created_at INTEGER NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
	name TEXT NOT NULL DEFAULT '',
	message TEXT NOT NULL DEFAULT '',
	image BLOB NOT NULL
);

CREATE INDEX drawings_status_created ON drawings (status, created_at DESC);

CREATE TABLE counters (
	key TEXT PRIMARY KEY,
	value INTEGER NOT NULL DEFAULT 0
);

INSERT INTO counters (key, value) VALUES ('visits', 0);
