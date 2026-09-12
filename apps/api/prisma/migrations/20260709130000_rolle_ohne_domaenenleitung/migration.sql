-- AlterEnum: Funktionsrolle „domaenenleitung" entfernen (nur noch
-- moderation, logbuchfuehrer, delegierte). Keine Zeile nutzt den Wert.
BEGIN;
CREATE TYPE "RolleTyp_new" AS ENUM ('moderation', 'logbuchfuehrer', 'delegierte');
ALTER TABLE "Rollenzuweisung" ALTER COLUMN "rolleTyp" TYPE "RolleTyp_new" USING ("rolleTyp"::text::"RolleTyp_new");
ALTER TYPE "RolleTyp" RENAME TO "RolleTyp_old";
ALTER TYPE "RolleTyp_new" RENAME TO "RolleTyp";
DROP TYPE "RolleTyp_old";
COMMIT;
