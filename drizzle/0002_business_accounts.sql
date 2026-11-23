CREATE TABLE businesses(id TEXT PRIMARY KEY,name TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,business_id TEXT REFERENCES businesses(id),role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('super_admin','technician','viewer')),active INTEGER NOT NULL DEFAULT 1);
--> statement-breakpoint
CREATE TABLE properties(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),name TEXT NOT NULL,type TEXT NOT NULL,UNIQUE(business_id,name));
--> statement-breakpoint
ALTER TABLE records ADD COLUMN business_id TEXT NOT NULL DEFAULT 'xposure';
--> statement-breakpoint
DROP INDEX camera_per_recorder;
--> statement-breakpoint
CREATE UNIQUE INDEX camera_per_business_recorder ON records(business_id,lower(trim(json_extract(payload,'$.school'))),lower(trim(coalesce(json_extract(payload,'$.recorder'),''))),lower(trim(json_extract(payload,'$.camera')))) WHERE kind='register';
--> statement-breakpoint
CREATE INDEX records_business ON records(business_id);
