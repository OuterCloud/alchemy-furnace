-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `image` VARCHAR(191) NULL,
    `plan` ENUM('FREE', 'PRO', 'ENTERPRISE') NOT NULL DEFAULT 'FREE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts` (
    `provider` VARCHAR(191) NOT NULL,
    `providerAccountId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `accessToken` TEXT NULL,
    `refreshToken` TEXT NULL,
    `idToken` TEXT NULL,
    `expiresAt` INTEGER NULL,
    `tokenType` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`provider`, `providerAccountId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `sessionToken` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sessions_sessionToken_key`(`sessionToken`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification_tokens` (
    `identifier` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    PRIMARY KEY (`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workspaces` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `plan` ENUM('FREE', 'PRO', 'ENTERPRISE') NOT NULL DEFAULT 'FREE',
    `logoUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `workspaces_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workspace_members` (
    `userId` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`, `workspaceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skills` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `systemPrompt` LONGTEXT NOT NULL,
    `examples` JSON NULL,
    `metadata` JSON NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 1,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `workspaceId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `skills_workspaceId_idx`(`workspaceId`),
    INDEX `skills_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skill_versions` (
    `id` VARCHAR(191) NOT NULL,
    `skillId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `systemPrompt` LONGTEXT NOT NULL,
    `examples` JSON NULL,
    `changeNote` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `skill_versions_skillId_idx`(`skillId`),
    UNIQUE INDEX `skill_versions_skillId_version_key`(`skillId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `source_materials` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('PDF', 'URL', 'TEXT', 'AUDIO') NOT NULL,
    `title` VARCHAR(191) NULL,
    `content` LONGTEXT NULL,
    `fileUrl` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `mimeType` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `workspaceId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `source_materials_workspaceId_idx`(`workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refinement_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `skillId` VARCHAR(191) NULL,
    `instruction` TEXT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `result` JSON NULL,
    `error` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `refinement_jobs_sourceId_idx`(`sourceId`),
    INDEX `refinement_jobs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workspace_members` ADD CONSTRAINT `workspace_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workspace_members` ADD CONSTRAINT `workspace_members_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `skills` ADD CONSTRAINT `skills_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `skill_versions` ADD CONSTRAINT `skill_versions_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `skills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `source_materials` ADD CONSTRAINT `source_materials_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refinement_jobs` ADD CONSTRAINT `refinement_jobs_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `source_materials`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refinement_jobs` ADD CONSTRAINT `refinement_jobs_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `skills`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
