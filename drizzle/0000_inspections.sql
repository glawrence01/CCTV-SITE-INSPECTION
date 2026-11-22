CREATE TABLE records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE UNIQUE INDEX camera_identity ON records(lower(trim(json_extract(payload,'$.school'))),lower(trim(json_extract(payload,'$.camera')))) WHERE kind='register';
