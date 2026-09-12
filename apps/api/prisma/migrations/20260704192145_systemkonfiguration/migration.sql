-- CreateTable
CREATE TABLE "Systemkonfiguration" (
    "id" TEXT NOT NULL,
    "schluessel" TEXT NOT NULL,
    "wertVerschluesselt" TEXT NOT NULL,
    "aktualisiertAm" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Systemkonfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Systemkonfiguration_schluessel_key" ON "Systemkonfiguration"("schluessel");
