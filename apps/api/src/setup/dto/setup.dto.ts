import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export type StartRolle = 'admin' | 'moderation' | 'teilhabender';
export const START_ROLLEN: StartRolle[] = ['admin', 'moderation', 'teilhabender'];

export class SmtpDto {
  @IsString()
  @IsNotEmpty({ message: 'SMTP-Host ist erforderlich.' })
  host!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @IsOptional()
  @IsString()
  user?: string;

  @IsOptional()
  @IsString()
  passwort?: string;

  @IsString()
  @IsNotEmpty({ message: 'Absender-Adresse ist erforderlich.' })
  absender!: string;
}

export class HauptdomaeneDto {
  @IsString()
  @IsNotEmpty({ message: 'Der Name der Hauptdomäne ist erforderlich.' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Das Ziel ist erforderlich.' })
  ziel!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Mindestens eine Domänenaufgabe ist erforderlich.' })
  @ArrayMaxSize(10, { message: 'Höchstens 10 Domänenaufgaben erlaubt.' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'Eine Domänenaufgabe darf nicht leer sein.' })
  tasks!: string[];
}

export class StartpersonDto {
  @IsString()
  @IsNotEmpty({ message: 'Der Name ist erforderlich.' })
  name!: string;

  @IsEmail({}, { message: 'Bitte eine gültige E-Mail-Adresse angeben.' })
  email!: string;

  @IsIn(START_ROLLEN, { message: 'Rolle muss admin, moderation oder teilhabender sein.' })
  rolle!: StartRolle;
}

export class SetupDto {
  // Optional: Ist auf dem Server bereits ein SMTP-Relay per Env (SMTP_*)
  // hinterlegt (Betriebsmodell A), überspringt der Assistent die SMTP-Eingabe
  // und dieses Feld bleibt leer – der Versand nutzt dann das Env-Relay.
  @IsOptional()
  @ValidateNested()
  @Type(() => SmtpDto)
  smtp?: SmtpDto;

  @IsString()
  @IsNotEmpty({ message: 'Der Organisationsname ist erforderlich.' })
  organisationName!: string;

  @ValidateNested()
  @Type(() => HauptdomaeneDto)
  hauptdomaene!: HauptdomaeneDto;

  @IsArray()
  @ArrayMinSize(3, { message: 'Es müssen genau 3 Startpersonen angegeben werden.' })
  @ArrayMaxSize(3, { message: 'Es müssen genau 3 Startpersonen angegeben werden.' })
  @ValidateNested({ each: true })
  @Type(() => StartpersonDto)
  startpersonen!: StartpersonDto[];
}

export class EinladungAktivierenDto {
  @IsString()
  @MinLength(8, { message: 'Das Passwort muss mindestens 8 Zeichen haben.' })
  passwort!: string;
}
