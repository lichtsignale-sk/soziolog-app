import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import type { KorrekturZielTyp } from '@soziolog/shared';

/** Eingabe zum Stellen eines Korrekturantrags (Feldprüfung im Service/Whitelist). */
export class KorrekturAntragDto {
  @IsIn(['vorschlag', 'bedenken', 'einwand', 'beschluss'], {
    message: 'zielTyp muss vorschlag, bedenken, einwand oder beschluss sein.',
  })
  zielTyp!: KorrekturZielTyp;

  @IsUUID(undefined, { message: 'zielId muss eine gültige ID sein.' })
  zielId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Das Feld darf nicht leer sein.' })
  feld!: string;

  @IsString()
  @IsNotEmpty({ message: 'Der neue Inhalt darf nicht leer sein.' })
  neuerInhalt!: string;

  @IsOptional()
  @IsString()
  begruendung?: string;
}

/** Ablehnung eines Korrekturantrags – Begründung ist Pflicht. */
export class KorrekturAblehnenDto {
  @IsString()
  @IsNotEmpty({ message: 'Eine Begründung für die Ablehnung ist erforderlich.' })
  grund!: string;
}
