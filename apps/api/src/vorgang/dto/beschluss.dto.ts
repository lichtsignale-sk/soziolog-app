import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import type { Befristung } from '@soziolog/shared';

export class BeschlussErstellenDto {
  @IsString()
  @IsNotEmpty({ message: 'Der Inhalt darf nicht leer sein.' })
  inhalt!: string;

  @IsOptional()
  @IsString()
  notiz?: string;

  @IsIn(['befristet', 'unbefristet'], {
    message: 'befristung muss befristet oder unbefristet sein.',
  })
  befristung!: Befristung;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Datum muss YYYY-MM-DD sein.' })
  ueberpruefungsdatum?: string;

  /** Optional: löst einen bestehenden Beschluss desselben Domäne ab. */
  @IsOptional()
  @IsUUID()
  ersetztBeschlussId?: string;
}
