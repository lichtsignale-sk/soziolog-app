import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Demo-Zugang anfragen: Die (festen) Demo-Zugangsdaten werden per Mail an die
 * angegebene Adresse geschickt. `webseite` ist ein Honeypot – ein für Menschen
 * unsichtbares Feld; ist es ausgefüllt, war es ein Bot.
 */
export class DemoAnfrageDto {
  @IsEmail({}, { message: 'Bitte eine gültige E-Mail-Adresse angeben.' })
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  webseite?: string;
}

/** Pilotphase anfragen: Interessens-Anfrage an das Team (`ANFRAGE_EMPFAENGER`). */
export class PilotAnfrageDto {
  @IsString()
  @IsNotEmpty({ message: 'Organisation ist erforderlich.' })
  @MaxLength(200)
  organisation!: string;

  @IsString()
  @IsNotEmpty({ message: 'Ansprechperson ist erforderlich.' })
  @MaxLength(120)
  name!: string;

  @IsEmail({}, { message: 'Bitte eine gültige E-Mail-Adresse angeben.' })
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  art?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  groesse?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  nachricht?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  webseite?: string;
}
