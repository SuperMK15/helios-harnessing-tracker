ALTER TABLE `harness_tracking` ADD `archived` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `harness_tracking` ADD `system` text;--> statement-breakpoint
ALTER TABLE `harness_tracking` ADD `name` text;--> statement-breakpoint
ALTER TABLE `harness_tracking` ADD `endpoints` text;--> statement-breakpoint
ALTER TABLE `harness_tracking` ADD `connector` text;