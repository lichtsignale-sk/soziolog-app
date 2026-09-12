import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class PasswortZuruecksetzenDto {
  @IsString()
  @IsNotEmpty({ message: 'Token ist erforderlich.' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Das neue Passwort muss mindestens 8 Zeichen haben.' })
  neuesPasswort!: string;
}
