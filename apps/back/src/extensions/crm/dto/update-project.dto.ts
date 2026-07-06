import { PartialType } from '@nestjs/swagger';
import { CreateCrmProjectDto } from './create-project.dto';

export class UpdateCrmProjectDto extends PartialType(CreateCrmProjectDto) {}