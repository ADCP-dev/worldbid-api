import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class GraphNode {
  @ApiProperty({ type: String })
  @Expose()
  id: string;

  @ApiProperty({ type: String })
  @Expose()
  label: string;

  @ApiProperty({ type: [String] })
  @Expose()
  tags: string[];

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  categoryPath: string | null;

  @ApiProperty({ type: Number })
  @Expose()
  degree: number;
}

export class GraphEdge {
  @ApiProperty({ type: String })
  @Expose()
  source: string;

  @ApiProperty({ type: String })
  @Expose()
  target: string;
}

export class GraphData {
  @ApiProperty({ type: [GraphNode] })
  @Expose()
  nodes: GraphNode[];

  @ApiProperty({ type: [GraphEdge] })
  @Expose()
  edges: GraphEdge[];
}