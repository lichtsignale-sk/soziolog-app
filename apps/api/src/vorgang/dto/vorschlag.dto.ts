import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import type { GovernanceTyp } from '@soziolog/shared';

export class VorschlagErstellenDto {
  @IsString()
  @IsNotEmpty({ message: 'Der Titel darf nicht leer sein.' })
  titel!: string;

  @IsString()
  @IsNotEmpty({ message: 'Der Inhalt darf nicht leer sein.' })
  inhalt!: string;

  @IsIn(['governance', 'operativ'], {
    message: 'governanceTyp muss governance oder operativ sein.',
  })
  governanceTyp!: GovernanceTyp;

  @IsOptional()
  @IsUUID()
  sitzungId?: string;

  /** Optional: markiert diesen Vorschlag als Neufassung, die den Beschluss ablöst. */
  @IsOptional()
  @IsUUID()
  ersetztBeschlussId?: string;
}
