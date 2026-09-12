import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class PasswortAendernDto {
  @IsString()
  @IsNotEmpty({ message: 'Das aktuelle Passwort ist erforderlich.' })
  altesPasswort!: string;

  @IsString()
  @MinLength(8, { message: 'Das neue Passwort muss mindestens 8 Zeichen haben.' })
  neuesPasswort!: string;
}
