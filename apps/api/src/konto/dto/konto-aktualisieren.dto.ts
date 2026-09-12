import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/**
 * Konto-Selbstverwaltung: NUR diese Felder dürfen geändert werden (Name,
 * Anzeigename, Nutzername, E-Mail, Benachrichtigungen). istAdmin, Domänen und
 * Rollen sind bewusst NICHT enthalten (whitelist entfernt unbekannte Felder
 * zusätzlich serverseitig).
 */
export class KontoAktualisierenDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Der Name darf nicht leer sein.' })
  name?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Der Nutzername muss mindestens 3 Zeichen haben.' })
  nutzername?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Bitte eine gültige E-Mail-Adresse angeben.' })
  loginEmail?: string;

  @IsOptional()
  @IsBoolean()
  benachrichtigungenAktiv?: boolean;
}
