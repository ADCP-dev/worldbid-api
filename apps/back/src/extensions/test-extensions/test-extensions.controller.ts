import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
} from '@nestjs/common';
import { TestExtensionsService } from './test-extensions.service';
import { CreateTestExtensionDto } from './dto/create-test-extension.dto';
import { UpdateTestExtensionDto } from './dto/update-test-extension.dto';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { TestExtension } from './domain/test-extension';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../../utils/dto/infinity-pagination-response.dto';
import { FindAllTestExtensionsDto } from './dto/find-all-test-extensions.dto';
import { FindAllTestExtensionsPaginatedDto } from './dto/find-all-test-extensions-paginated.dto';
import { Request } from 'express';
import { JwtAuth } from '../../auth/decorators/auth.decorator';


@ApiTags('Testextensions')
@JwtAuth()
@Controller({
  path: 'test-extensions',
  version: '1',
})
export class TestExtensionsController {
  constructor(private readonly testExtensionsService: TestExtensionsService) {}

  @Post()
  @ApiCreatedResponse({
    type: TestExtension,
  })
  create(@Body() createTestExtensionDto: CreateTestExtensionDto) {
    return this.testExtensionsService.create(createTestExtensionDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(TestExtension),
  })
  async findAllWithPagination(
    @Query() query: FindAllTestExtensionsPaginatedDto,
    @Req() req: Request,
  ): Promise<InfinityPaginationResponseDto<TestExtension>> {
    query.originalUrl = req.originalUrl; // For pagination
    return this.testExtensionsService.findAllWithPagination(query);
  }

  @Get('all')
  @ApiOkResponse({
    type: [TestExtension],
  })
  findAll(@Query() query: FindAllTestExtensionsDto) {
    return this.testExtensionsService.findAll(query);
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: TestExtension,
  })
  findById(@Param('id') id: string) {
    return this.testExtensionsService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: TestExtension,
  })
  update(
    @Param('id') id: string,
    @Body() updateTestExtensionDto: UpdateTestExtensionDto,
  ) {
    return this.testExtensionsService.update(id, updateTestExtensionDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  remove(@Param('id') id: string) {
    return this.testExtensionsService.remove(id);
  }
}
