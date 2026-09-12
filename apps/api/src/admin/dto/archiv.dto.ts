import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import type { ArchivierenAktion } from '@soziolog/shared';

const AKTIONEN: ArchivierenAktion[] = ['loeschen', 'behalten_in_domaene'];

/** Entscheidung für eine verwaisende Person beim Archivieren einer Domäne. */
export class ArchivierenEntscheidungDto {
  @IsUUID()
  personId!: string;

  @IsIn(AKTIONEN, { message: 'aktion muss loeschen oder behalten_in_domaene sein.' })
  aktion!: ArchivierenAktion;

  @IsOptional()
  @IsUUID(undefined, { message: 'zielDomaeneId muss eine gültige ID sein.' })
  zielDomaeneId?: string;
}

export class ArchivierenDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArchivierenEntscheidungDto)
  entscheidungen!: ArchivierenEntscheidungDto[];
}
