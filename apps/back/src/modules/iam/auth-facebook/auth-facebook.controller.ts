import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  SerializeOptions,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from '@iam/auth/auth.service';
import { AuthFacebookService } from '@iam/auth-facebook/auth-facebook.service';
import { AuthFacebookLoginDto } from '@iam/auth-facebook/dto/auth-facebook-login.dto';
import { LoginResponseDto } from '@iam/auth/dto/login-response.dto';

@ApiTags('Auth')
@Controller({
  path: 'auth/facebook',
  version: '1',
})
export class AuthFacebookController {
  constructor(
    private readonly authService: AuthService,
    private readonly authFacebookService: AuthFacebookService,
  ) {}

  @ApiOkResponse({
    type: LoginResponseDto,
  })
  @SerializeOptions({
    groups: ['me'],
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: AuthFacebookLoginDto,
    @Headers('x-custom-lang') lang?: string,
  ): Promise<LoginResponseDto> {
    const socialData =
      await this.authFacebookService.getProfileByToken(loginDto);

    return this.authService.validateSocialLogin('facebook', socialData, lang);
  }
}
