import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class BedenkenErstellenDto {
  @IsString()
  @IsNotEmpty({ message: 'Der Inhalt darf nicht leer sein.' })
  inhalt!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Datum muss YYYY-MM-DD sein.' })
  datum?: string;
}
