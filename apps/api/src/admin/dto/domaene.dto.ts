import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import type { RolleTyp } from '@soziolog/shared';

export const ROLLEN: RolleTyp[] = ['moderation', 'logbuchfuehrer', 'delegierte'];
const DOMAENETYPEN = ['dauerdomaene', 'arbeitsdomaene'] as const;

export class StartbesetzungDto {
  @IsUUID()
  personId!: string;

  @IsOptional()
  @IsIn(ROLLEN, { message: 'Unbekannter Rollentyp.' })
  rolleTyp?: RolleTyp;
}

export class DomaeneErstellenDto {
  @IsString()
  @IsNotEmpty({ message: 'Der Name darf nicht leer sein.' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Das Ziel darf nicht leer sein.' })
  ziel!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Mindestens eine Domänenaufgabe ist erforderlich.' })
  @ArrayMaxSize(10, { message: 'Höchstens 10 Domänenaufgaben erlaubt.' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'Eine Domänenaufgabe darf nicht leer sein.' })
  tasks!: string[];

  @IsOptional()
  @IsIn(DOMAENETYPEN)
  typ?: 'dauerdomaene' | 'arbeitsdomaene';

  @IsOptional()
  @IsUUID()
  elternDomaeneId?: string;

  @IsArray()
  @ArrayMinSize(3, {
    message: 'Gründungsregel a: mindestens 3 Mitglieder erforderlich.',
  })
  @ValidateNested({ each: true })
  @Type(() => StartbesetzungDto)
  besetzung!: StartbesetzungDto[];
}

export class DomaeneAktualisierenDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ziel?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Mindestens eine Domänenaufgabe ist erforderlich.' })
  @ArrayMaxSize(10, { message: 'Höchstens 10 Domänenaufgaben erlaubt.' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'Eine Domänenaufgabe darf nicht leer sein.' })
  tasks?: string[];

  @IsOptional()
  @IsIn(DOMAENETYPEN)
  typ?: 'dauerdomaene' | 'arbeitsdomaene';

  @IsOptional()
  @IsBoolean()
  aktiv?: boolean;
}

export class MitgliedHinzufuegenDto {
  @IsUUID()
  personId!: string;
}

export class RolleHinzufuegenDto {
  @IsUUID()
  personId!: string;

  @IsIn(ROLLEN, { message: 'Unbekannter Rollentyp.' })
  rolleTyp!: RolleTyp;
}
