/*
  Warnings:

  - You are about to drop the column `emoji` on the `credential` table. All the data in the column will be lost.
  - You are about to drop the column `emoji` on the `env_project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `credential` DROP COLUMN `emoji`;

-- AlterTable
ALTER TABLE `env_project` DROP COLUMN `emoji`;
