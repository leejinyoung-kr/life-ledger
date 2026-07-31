-- DropForeignKey
ALTER TABLE `calendar_event` DROP FOREIGN KEY `calendar_event_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `note` DROP FOREIGN KEY `note_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `task` DROP FOREIGN KEY `task_user_id_fkey`;

-- DropTable
DROP TABLE `calendar_event`;

-- DropTable
DROP TABLE `note`;

-- DropTable
DROP TABLE `task`;
