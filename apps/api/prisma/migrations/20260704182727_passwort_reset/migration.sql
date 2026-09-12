-- CreateTable
CREATE TABLE "PasswortReset" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "laeuftAbAm" DATE NOT NULL,
    "eingeloestAm" DATE,

    CONSTRAINT "PasswortReset_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PasswortReset" ADD CONSTRAINT "PasswortReset_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
