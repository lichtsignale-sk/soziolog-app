-- AlterTable
ALTER TABLE "Domaene" ADD COLUMN     "anzahlBedenken" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "anzahlEinwaende" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "anzahlNutzer" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "bedenkenProMonat" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
