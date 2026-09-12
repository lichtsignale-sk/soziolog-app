import { IsEmail } from 'class-validator';

export class PasswortVergessenDto {
  @IsEmail({}, { message: 'Bitte eine gültige E-Mail-Adresse angeben.' })
  email!: string;
}
