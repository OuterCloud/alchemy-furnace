-- AlterTable
ALTER TABLE `conversations` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `knowledge_bases` ALTER COLUMN `workspaceId` DROP DEFAULT,
    ALTER COLUMN `createdById` DROP DEFAULT,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `roles` ADD COLUMN `allowDataRequest` BOOLEAN NOT NULL DEFAULT false;
