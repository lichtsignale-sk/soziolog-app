-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "zweiFaktorCodeGesendetAm" TIMESTAMP(3),
ALTER COLUMN "zweiFaktorCodeLaeuftAbAm" SET DATA TYPE TIMESTAMP(3);
