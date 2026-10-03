import { Module } from '@nestjs/common';
import { KitchenService } from './kitchen.service';
import { KitchenController } from './kitchen.controller';

@Module({
  providers: [KitchenService],
  controllers: [KitchenController],
  exports: [KitchenService],
})
export class KitchenModule {}
