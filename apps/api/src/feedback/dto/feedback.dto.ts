import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const FEEDBACK_TEXT_MAX = 5000;

/** Ein Feedback aus der App. */
export class FeedbackDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Bitte schreib uns kurz, worum es geht.' })
  @MaxLength(FEEDBACK_TEXT_MAX, {
    message: `Das Feedback darf höchstens ${FEEDBACK_TEXT_MAX} Zeichen lang sein.`,
  })
  text!: string;

  /**
   * NUR DER PFAD der Seite, auf der das Feedback entstand — ohne Query und
   * ohne Fragment. Dort können Tokens stehen (Passwort-Reset, Einladung), und
   * die sollen nicht in einer Mail landen.
   */
  @IsString()
  @Matches(/^\/[A-Za-z0-9\-._~/%]{0,299}$/, {
    message: 'Die Seitenangabe ist ungültig.',
  })
  seite!: string;

  /** Lesbarer Name der Seite, z. B. „Gesamt-Log" — nur Buchstaben, Ziffern und schlichte Satzzeichen. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[\p{L}\p{N} ()\-–.]+$/u, { message: 'Die Seitenbezeichnung ist ungültig.' })
  seitenBezeichnung!: string;

  /** Häkchen „Ihr dürft mich für Rückfragen kontaktieren". */
  @IsBoolean()
  rueckfragenErlaubt!: boolean;
}
