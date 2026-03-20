-- CreateTable
CREATE TABLE "Speech" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "catalogId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "templateType" TEXT NOT NULL DEFAULT 'sales_pitch',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Speech_catalogId_idx" ON "Speech"("catalogId");
