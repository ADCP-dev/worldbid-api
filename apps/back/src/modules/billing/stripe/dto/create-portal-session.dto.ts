import { IsString } from 'class-validator';

export class CreatePortalSessionDto {
  @IsString()
  sessionId: string;
}
