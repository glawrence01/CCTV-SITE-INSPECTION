ALTER TABLE accounts ADD COLUMN platform_blocked INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE businesses ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE subscriptions(business_id TEXT PRIMARY KEY REFERENCES businesses(id),plan TEXT NOT NULL,status TEXT NOT NULL,renewal TEXT,notes TEXT);
--> statement-breakpoint
CREATE TABLE invoices(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),description TEXT NOT NULL,amount_minor INTEGER NOT NULL,currency TEXT NOT NULL,due TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Unpaid',payment_reference TEXT,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TABLE support_cases(id TEXT PRIMARY KEY,business_id TEXT REFERENCES businesses(id),email TEXT NOT NULL,subject TEXT NOT NULL,details TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Open',resolution TEXT,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TABLE admin_audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,details TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TABLE email_events(id TEXT PRIMARY KEY,email TEXT NOT NULL,action TEXT NOT NULL,outcome TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
