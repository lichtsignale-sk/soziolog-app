import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Nutzername oder E-Mail ist erforderlich.' })
  nutzernameOderEmail!: string;

  @IsString()
  @IsNotEmpty({ message: 'Passwort ist erforderlich.' })
  passwort!: string;
}
