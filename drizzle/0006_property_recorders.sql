CREATE TABLE property_recorders (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id),
  name TEXT NOT NULL COLLATE NOCASE,
  type TEXT NOT NULL CHECK(type IN ('DVR','NVR','DVR/NVR')),
  UNIQUE(property_id,name)
);
--> statement-breakpoint
INSERT OR IGNORE INTO properties(id,business_id,name,type)
SELECT lower(hex(randomblob(16))),business_id,json_extract(payload,'$.school'),'School'
FROM records
WHERE nullif(trim(json_extract(payload,'$.school')),'') IS NOT NULL
GROUP BY business_id,json_extract(payload,'$.school');
--> statement-breakpoint
INSERT OR IGNORE INTO property_recorders(id,property_id,name,type)
SELECT lower(hex(randomblob(16))),p.id,trim(json_extract(r.payload,'$.recorder')),'DVR/NVR'
FROM records r JOIN properties p ON p.business_id=r.business_id AND p.name=json_extract(r.payload,'$.school')
WHERE r.kind IN ('register','round','recorder','camera') AND nullif(trim(json_extract(r.payload,'$.recorder')),'') IS NOT NULL
GROUP BY p.id,lower(trim(json_extract(r.payload,'$.recorder')));
