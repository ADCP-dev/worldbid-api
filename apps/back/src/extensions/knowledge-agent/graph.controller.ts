import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GraphService } from './graph.service';
import { QueryGraphDto } from './dto/query-graph.dto';
import { GraphData } from './domain/graph';
import { JwtAuth } from '@iam/auth/decorators/auth.decorator';
import { UserId } from '@iam/auth/decorators/current-user.decorator';

@ApiTags('Knowledge Graph')
@JwtAuth()
@Controller({
  path: 'ka/graph',
  version: '1',
})
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get()
  @ApiOkResponse({ type: GraphData })
  getGraph(
    @UserId() userId: number,
    @Query() query: QueryGraphDto,
  ): Promise<GraphData> {
    return this.graphService.getGraph(userId, {
      categoryPath: query.categoryPath,
      tag: query.tag,
    });
  }
}