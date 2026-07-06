import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { PlatformsService } from '@ext/upload-post/services/platforms.service';
import { InstagramService } from '@ext/upload-post/services/instagram.service';
import {
  InstagramCommentReplyDto,
  InstagramDmDto,
  GoogleBusinessSelectDto,
} from '@ext/upload-post/dto/common.dto';

@ApiTags('Upload-Post')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'upload-post/platforms', version: '1' })
export class PlatformsController {
  constructor(private readonly platformsService: PlatformsService) {}

  @Get('facebook/pages')
  getFacebookPages() { return this.platformsService.getFacebookPages(); }

  @Get('linkedin/pages')
  getLinkedinPages() { return this.platformsService.getLinkedinPages(); }

  @Get('pinterest/boards')
  getPinterestBoards() { return this.platformsService.getPinterestBoards(); }

  @Get('google-business/locations')
  getGoogleBusinessLocations() { return this.platformsService.getGoogleBusinessLocations(); }

  @Post('google-business/locations/select')
  @HttpCode(HttpStatus.OK)
  selectGoogleBusinessLocation(@Body() dto: GoogleBusinessSelectDto) {
    return this.platformsService.selectGoogleBusinessLocation(dto.locationId);
  }

  @Get('reddit/detailed-posts/:postId')
  getRedditPost(@Param('postId') postId: string) {
    return this.platformsService.getRedditDetailedPost(postId);
  }
}

@ApiTags('Upload-Post')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'upload-post/instagram', version: '1' })
export class InstagramController {
  constructor(private readonly instagramService: InstagramService) {}

  @Get('media')
  getMedia() { return this.instagramService.getMedia(); }

  @Get('comments')
  getComments(@Query('postUrl') postUrl: string) { return this.instagramService.getComments(postUrl); }

  @Post('comments/reply')
  @HttpCode(HttpStatus.OK)
  replyToComment(@Body() dto: InstagramCommentReplyDto) {
    return this.instagramService.replyToComment(dto.commentId, dto.message);
  }

  @Post('dms/send')
  @HttpCode(HttpStatus.OK)
  sendDm(@Body() dto: InstagramDmDto) {
    return this.instagramService.sendDm(dto.username, dto.message);
  }

  @Get('dms/conversations')
  getConversations() { return this.instagramService.getConversations(); }
}