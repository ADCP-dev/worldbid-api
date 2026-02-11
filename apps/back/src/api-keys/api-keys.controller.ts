import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyResponseDto } from './dto/api-key-response.dto';
import { UserId } from '../auth/decorators/current-user.decorator';

@ApiTags('API Keys')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'api-keys',
  version: '1',
})
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user API key' })
  @ApiResponse({
    status: 200,
    description: 'API key retrieved successfully',
    type: ApiKeyResponseDto,
  })
  async getApiKey(@UserId() userId: number): Promise<ApiKeyResponseDto | null> {
    let apiKey = await this.apiKeysService.findByUserId(userId);
    if (!apiKey) {
      apiKey = await this.apiKeysService.regenerateApiKey(userId);
    }

    return {
      id: apiKey.id,
      key: apiKey.key,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
    };
  }

  @Post('regenerate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate API key for current user' })
  @ApiResponse({
    status: 200,
    description: 'API key regenerated successfully',
    type: ApiKeyResponseDto,
  })
  async regenerateApiKey(@UserId() userId: number): Promise<ApiKeyResponseDto> {
    const apiKey = await this.apiKeysService.regenerateApiKey(userId);

    return {
      id: apiKey.id,
      key: apiKey.key,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
    };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke current user API key' })
  @ApiResponse({
    status: 204,
    description: 'API key revoked successfully',
  })
  async revokeApiKey(@UserId() userId: number): Promise<void> {
    await this.apiKeysService.revokeApiKey(userId);
  }
}
