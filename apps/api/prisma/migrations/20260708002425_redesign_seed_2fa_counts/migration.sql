/*
  Warnings:

  - You are about to drop the column `zweiFaktorSecret` on the `Person` table. All the data in the column will be lost.
  - You are about to drop the `ZweiFaktorBackupCode` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Korrekturantrag" DROP CONSTRAINT "Korrekturantrag_beantragtVonId_fkey";

-- DropForeignKey
ALTER TABLE "ZweiFaktorBackupCode" DROP CONSTRAINT "ZweiFaktorBackupCode_personId_fkey";

-- AlterTable
ALTER TABLE "Domaene" ADD COLUMN     "anzahlBeschluesse" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "anzahlOffen" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Korrekturantrag" ADD COLUMN     "beantragtVonDomaene" TEXT,
ADD COLUMN     "beantragtVonName" TEXT,
ADD COLUMN     "beantragtVonRolle" TEXT,
ADD COLUMN     "bestaetigtVonName" TEXT,
ALTER COLUMN "beantragtVonId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Person" DROP COLUMN "zweiFaktorSecret",
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "passwortGeaendertAm" DATE,
ADD COLUMN     "zweiFaktorCodeHash" TEXT,
ADD COLUMN     "zweiFaktorCodeLaeuftAbAm" DATE;

-- DropTable
DROP TABLE "ZweiFaktorBackupCode";

-- AddForeignKey
ALTER TABLE "Korrekturantrag" ADD CONSTRAINT "Korrekturantrag_beantragtVonId_fkey" FOREIGN KEY ("beantragtVonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
