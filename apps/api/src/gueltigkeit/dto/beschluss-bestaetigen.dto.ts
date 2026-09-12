import { IsIn, IsOptional, Matches } from 'class-validator';
import type { Befristung } from '@soziolog/shared';

export class BeschlussBestaetigenDto {
  @IsIn(['befristet', 'unbefristet'], {
    message: 'befristung muss befristet oder unbefristet sein.',
  })
  befristung!: Befristung;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Datum muss YYYY-MM-DD sein.' })
  ueberpruefungsdatum?: string;
}
