import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import type { EinwandSchweregrad } from '@soziolog/shared';

export class EinwandErstellenDto {
  @IsString()
  @IsNotEmpty({ message: 'Der Inhalt darf nicht leer sein.' })
  inhalt!: string;

  @IsIn(['leicht', 'schwerwiegend'], {
    message: 'schweregrad muss leicht oder schwerwiegend sein.',
  })
  schweregrad!: EinwandSchweregrad;

  @IsOptional()
  @IsString()
  integration?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Datum muss YYYY-MM-DD sein.' })
  datum?: string;
}
