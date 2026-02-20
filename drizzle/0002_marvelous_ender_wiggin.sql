CREATE TABLE `user_interests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`topic` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `edition_articles` ADD `section` text;--> statement-breakpoint
ALTER TABLE `edition_articles` ADD `position` integer;--> statement-breakpoint
ALTER TABLE `edition_articles` ADD `expanded_summary` text;