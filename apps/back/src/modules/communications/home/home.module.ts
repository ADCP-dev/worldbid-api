import { Module } from '@nestjs/common';
import { HomeService } from '@comms/home/home.service';
import { HomeController } from '@comms/home/home.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
