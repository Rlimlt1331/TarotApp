-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'reader';

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "assignedReaderId" INTEGER;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignedReaderId_fkey" FOREIGN KEY ("assignedReaderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
