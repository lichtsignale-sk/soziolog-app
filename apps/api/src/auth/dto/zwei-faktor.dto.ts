import { IsNotEmpty, IsString, Length } from 'class-validator';

/** Login-Bestätigung mit dem 6-stelligen E-Mail-Code. */
export class ZweiFaktorLoginDto {
  @IsString()
  @Length(6, 6, { message: 'Der Code muss sechsstellig sein.' })
  code!: string;
}

/** Deaktivierung der 2FA verlangt die erneute Eingabe des Passworts. */
export class ZweiFaktorDeaktivierenDto {
  @IsString()
  @IsNotEmpty({ message: 'Das aktuelle Passwort ist erforderlich.' })
  aktuellesPasswort!: string;
}
