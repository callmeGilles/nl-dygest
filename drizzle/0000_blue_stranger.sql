CREATE TABLE `edition_articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` integer NOT NULL,
	`newsletter_id` integer NOT NULL,
	`category` text NOT NULL,
	`headline` text NOT NULL,
	`summary` text NOT NULL,
	`key_points` text NOT NULL,
	`reading_time` integer NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`newsletter_id`) REFERENCES `newsletters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `editions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`generated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `newsletters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gmail_id` text NOT NULL,
	`sender` text NOT NULL,
	`subject` text NOT NULL,
	`snippet` text NOT NULL,
	`received_at` text NOT NULL,
	`raw_html` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletters_gmail_id_unique` ON `newsletters` (`gmail_id`);--> statement-breakpoint
CREATE TABLE `reading_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`newsletters_read` integer NOT NULL,
	`time_spent` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `triage_decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`newsletter_id` integer NOT NULL,
	`decision` text NOT NULL,
	`triaged_at` text NOT NULL,
	FOREIGN KEY (`newsletter_id`) REFERENCES `newsletters`(`id`) ON UPDATE no action ON DELETE no action
);
