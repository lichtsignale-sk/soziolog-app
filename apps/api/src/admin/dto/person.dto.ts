import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class PersonAnlegenDto {
  @IsString()
  @IsNotEmpty({ message: 'Der Name darf nicht leer sein.' })
  name!: string;

  @IsString()
  @MinLength(3, { message: 'Der Nutzername muss mindestens 3 Zeichen haben.' })
  nutzername!: string;

  @IsEmail({}, { message: 'Bitte eine gültige E-Mail-Adresse angeben.' })
  loginEmail!: string;

  @IsOptional()
  @IsBoolean()
  istAdmin?: boolean;
}

export class PersonAktualisierenDto {
  @IsOptional()
  @IsBoolean()
  aktiv?: boolean;

  @IsOptional()
  @IsBoolean()
  istAdmin?: boolean;
}
