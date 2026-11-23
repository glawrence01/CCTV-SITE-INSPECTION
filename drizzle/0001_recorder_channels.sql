CREATE UNIQUE INDEX camera_per_recorder ON records (
  lower(trim(json_extract(payload,'$.school'))),
  lower(trim(coalesce(json_extract(payload,'$.recorder'),''))),
  lower(trim(json_extract(payload,'$.camera')))
) WHERE kind='register';
--> statement-breakpoint
DROP INDEX camera_identity;
