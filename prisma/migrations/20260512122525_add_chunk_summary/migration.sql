/*
  Warnings:

  - Added the required column `summary` to the `knowledge_chunks` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: add with default first, then drop the default so new rows must supply it
ALTER TABLE `knowledge_chunks` ADD COLUMN `summary` VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE `knowledge_chunks` ALTER COLUMN `summary` DROP DEFAULT;
