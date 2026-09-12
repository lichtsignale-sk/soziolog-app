-- Korrekturantrag: Pflichtbegruendung bei Ablehnung (getrennt von der
-- optionalen "begruendung" des Antragstellers bei Einreichung). Additiv.
ALTER TABLE "Korrekturantrag" ADD COLUMN "ablehnungsgrund" TEXT;
