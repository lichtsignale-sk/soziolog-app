import { Module } from '@nestjs/common';
import { RechteService } from './rechte.service';

@Module({
  providers: [RechteService],
  exports: [RechteService],
})
export class RechteModule {}
