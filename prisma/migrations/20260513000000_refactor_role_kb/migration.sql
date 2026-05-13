-- ============================================================
-- Migration: refactor_role_kb
-- Decouples Role (agent) from KnowledgeBase (workspace-level KB)
-- ============================================================

-- Step 1: Create `roles` table (mirrors current `skills`)
CREATE TABLE `roles` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `systemPrompt` LONGTEXT NOT NULL,
  `examples` JSON NULL,
  `metadata` JSON NULL,
  `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `isPublic` BOOLEAN NOT NULL DEFAULT false,
  `workspaceId` VARCHAR(191) NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `roles_workspaceId_idx`(`workspaceId`),
  INDEX `roles_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 2: Migrate data from `skills` to `roles`
INSERT INTO `roles` (`id`, `name`, `description`, `systemPrompt`, `examples`, `metadata`, `status`, `isPublic`, `workspaceId`, `createdById`, `createdAt`, `updatedAt`)
SELECT `id`, `name`, `description`, `systemPrompt`, `examples`, `metadata`, `status`, `isPublic`, `workspaceId`, `createdById`, `createdAt`, `updatedAt`
FROM `skills`;

-- Step 3: Add new columns to `knowledge_bases`
ALTER TABLE `knowledge_bases`
  ADD COLUMN `description` TEXT NULL,
  ADD COLUMN `workspaceId` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `createdById` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- Step 4: Populate `knowledge_bases.workspaceId` and `createdById` from skills
UPDATE `knowledge_bases` kb
JOIN `skills` s ON kb.`skillId` = s.`id`
SET kb.`workspaceId` = s.`workspaceId`,
    kb.`createdById` = s.`createdById`;

-- Step 5: Add workspace foreign key index
ALTER TABLE `knowledge_bases`
  ADD INDEX `knowledge_bases_workspaceId_idx`(`workspaceId`);

-- Step 6: Create `role_knowledge_bases` join table
CREATE TABLE `role_knowledge_bases` (
  `roleId` VARCHAR(191) NOT NULL,
  `knowledgeBaseId` VARCHAR(191) NOT NULL,
  `attachedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`roleId`, `knowledgeBaseId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 7: Migrate existing KB→Skill associations to role_knowledge_bases
INSERT INTO `role_knowledge_bases` (`roleId`, `knowledgeBaseId`, `attachedAt`)
SELECT `skillId`, `id`, `createdAt`
FROM `knowledge_bases`
WHERE `skillId` IS NOT NULL AND `skillId` != '';

-- Step 8: Drop old skillId FK and column from knowledge_bases
ALTER TABLE `knowledge_bases` DROP FOREIGN KEY `knowledge_bases_skillId_fkey`;
ALTER TABLE `knowledge_bases` DROP INDEX `knowledge_bases_skillId_idx`;
ALTER TABLE `knowledge_bases` DROP COLUMN `skillId`;

-- Step 9: Add FK constraints for role_knowledge_bases
ALTER TABLE `role_knowledge_bases`
  ADD CONSTRAINT `role_knowledge_bases_roleId_fkey`
    FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `role_knowledge_bases_knowledgeBaseId_fkey`
    FOREIGN KEY (`knowledgeBaseId`) REFERENCES `knowledge_bases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 10: Add FK for roles → workspaces
ALTER TABLE `roles`
  ADD CONSTRAINT `roles_workspaceId_fkey`
    FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 11: Add FK for knowledge_bases → workspaces
ALTER TABLE `knowledge_bases`
  ADD CONSTRAINT `knowledge_bases_workspaceId_fkey`
    FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 12: Create `conversations` table
CREATE TABLE `conversations` (
  `id` VARCHAR(191) NOT NULL,
  `title` TEXT NULL,
  `roleId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  INDEX `conversations_roleId_idx`(`roleId`),
  INDEX `conversations_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `conversations`
  ADD CONSTRAINT `conversations_roleId_fkey`
    FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 13: Create `messages` table
CREATE TABLE `messages` (
  `id` VARCHAR(191) NOT NULL,
  `conversationId` VARCHAR(191) NOT NULL,
  `role` ENUM('USER', 'ASSISTANT') NOT NULL,
  `content` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `messages_conversationId_idx`(`conversationId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `messages`
  ADD CONSTRAINT `messages_conversationId_fkey`
    FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 14: Update refinement_jobs: add roleId, migrate from skillId
ALTER TABLE `refinement_jobs`
  ADD COLUMN `roleId` VARCHAR(191) NULL;

UPDATE `refinement_jobs` SET `roleId` = `skillId` WHERE `skillId` IS NOT NULL;

ALTER TABLE `refinement_jobs`
  ADD INDEX `refinement_jobs_roleId_idx`(`roleId`),
  ADD CONSTRAINT `refinement_jobs_roleId_fkey`
    FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old skillId FK and column from refinement_jobs
-- (no explicit index existed; MySQL auto-index for FK is dropped automatically with the column)
ALTER TABLE `refinement_jobs` DROP FOREIGN KEY `refinement_jobs_skillId_fkey`;
ALTER TABLE `refinement_jobs` DROP COLUMN `skillId`;

-- Step 15: Drop skill_versions table
DROP TABLE IF EXISTS `skill_versions`;

-- Step 16: Drop skills table (data already migrated to roles)
DROP TABLE `skills`;
