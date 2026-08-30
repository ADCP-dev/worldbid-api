import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';
import {
  ListCommentsDto,
  ReplyCommentDto,
} from '@ext/upload-post/dto/upload-actions.dto';

/**
 * Unified (multi-platform) comments admin endpoints.
 * Wraps the normalized comments API added in WU1.
 */
@ApiTags('Upload-Post')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'upload-post/comments', version: '1' })
export class UploadPostCommentsController {
  constructor(private readonly client: UploadPostClientService) {}

  private resolveUser(user?: string): string {
    return user ?? this.client.profileUsername ?? '';
  }

  @Get()
  listComments(@Query() query: ListCommentsDto) {
    return this.client.listComments({
      user: this.resolveUser(query.user),
      platform: query.platform,
      postId: query.postId,
      postUrl: query.postUrl,
      after: query.after,
      limit: query.limit,
    });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  createComment(@Body() dto: ReplyCommentDto & { platform: string }) {
    return this.client.createComment({
      platform: (dto.platform ?? 'instagram') as 'instagram',
      user: this.resolveUser(),
      message: dto.message,
      commentId: dto.commentId,
    });
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  deleteComment(@Body() dto: { commentId: string; platform?: string }) {
    return this.client.deleteComment({
      platform: (dto.platform ?? 'instagram') as 'instagram',
      user: this.resolveUser(),
      commentId: dto.commentId,
    });
  }

  @Get('conversations')
  getDmConversations() {
    return this.client.getInstagramDmConversations();
  }
}
