CREATE TABLE `harness_tracking` (
	`id` text PRIMARY KEY NOT NULL,
	`length_mm` real,
	`mech_ready` integer NOT NULL,
	`soldered` integer NOT NULL,
	`installed` integer NOT NULL,
	`soldered_by` text NOT NULL,
	`inspected_by` text NOT NULL,
	`revision` integer NOT NULL
);
