import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Version,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { WebService } from './web.service';
import { ContactDto } from './dto/contact.dto';

@ApiTags('Web — Public Contact')
@Controller({ path: 'contact', version: '1' })
export class WebController {
  constructor(private readonly webService: WebService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async contact(@Body() dto: ContactDto) {
    // Service throws on real send failure → NestJS surfaces as 500 (R-CS-07).
    // Honeypot + valid → {success:true} (silent 201 either way).
    return this.webService.submit(dto);
  }
}