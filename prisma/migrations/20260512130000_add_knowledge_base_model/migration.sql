-- CreateTable: knowledge_bases
CREATE TABLE `knowledge_bases` (
    `id` VARCHAR(191) NOT NULL,
    `skillId` VARCHAR(191) NOT NULL,
    `type` ENUM('REFINEMENT', 'FILE', 'URL') NOT NULL DEFAULT 'REFINEMENT',
    `name` VARCHAR(191) NOT NULL,
    `sourceUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `knowledge_bases_skillId_idx`(`skillId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- For each unique skillId in knowledge_chunks, create a REFINEMENT KnowledgeBase
INSERT INTO `knowledge_bases` (`id`, `skillId`, `type`, `name`, `createdAt`)
SELECT
    CONCAT('kb_rf_', kc.`skillId`) AS `id`,
    kc.`skillId`,
    'REFINEMENT',
    s.`name`,
    MIN(kc.`createdAt`)
FROM `knowledge_chunks` kc
INNER JOIN `skills` s ON s.`id` = kc.`skillId`
GROUP BY kc.`skillId`, s.`name`;

-- Drop existing FK on skillId before removing the column
ALTER TABLE `knowledge_chunks` DROP FOREIGN KEY `knowledge_chunks_skillId_fkey`;

-- Add knowledgeBaseId column (nullable first)
ALTER TABLE `knowledge_chunks` ADD COLUMN `knowledgeBaseId` VARCHAR(191) NULL;

-- Populate knowledgeBaseId
UPDATE `knowledge_chunks` kc
INNER JOIN `knowledge_bases` kb ON kb.`skillId` = kc.`skillId` AND kb.`type` = 'REFINEMENT'
SET kc.`knowledgeBaseId` = kb.`id`;

-- Make knowledgeBaseId NOT NULL
ALTER TABLE `knowledge_chunks` MODIFY COLUMN `knowledgeBaseId` VARCHAR(191) NOT NULL;

-- Drop old index on skillId
ALTER TABLE `knowledge_chunks` DROP INDEX `knowledge_chunks_skillId_idx`;

-- Drop old columns
ALTER TABLE `knowledge_chunks` DROP COLUMN `skillId`;
ALTER TABLE `knowledge_chunks` DROP COLUMN `summary`;

-- Add index on knowledgeBaseId
ALTER TABLE `knowledge_chunks` ADD INDEX `knowledge_chunks_knowledgeBaseId_idx`(`knowledgeBaseId`);

-- AddForeignKey: knowledge_bases -> skills
ALTER TABLE `knowledge_bases` ADD CONSTRAINT `knowledge_bases_skillId_fkey`
    FOREIGN KEY (`skillId`) REFERENCES `skills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: knowledge_chunks -> knowledge_bases
ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_knowledgeBaseId_fkey`
    FOREIGN KEY (`knowledgeBaseId`) REFERENCES `knowledge_bases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
