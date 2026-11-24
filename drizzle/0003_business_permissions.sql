ALTER TABLE accounts ADD COLUMN permissions TEXT;
--> statement-breakpoint
CREATE TABLE access_invites(email TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),role TEXT NOT NULL CHECK(role IN ('technician','viewer')),permissions TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
