import { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export class InfinityPaginationResponseDto<T> {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
  first_page_url: string;
  last_page_url: string;
  next_page_url: string | null;
  prev_page_url: string | null;
  from: number;
  to: number;
  data: T[];
}

export function InfinityPaginationResponse<T>(classReference: Type<T>) {
  abstract class Pagination {
    @ApiProperty({ type: [classReference] })
    data!: T[];

    @ApiProperty({ type: Number })
    total!: number;

    @ApiProperty({ type: Number })
    per_page!: number;

    @ApiProperty({ type: Number })
    current_page!: number;

    @ApiProperty({ type: Number })
    last_page!: number;

    @ApiProperty({ type: String })
    first_page_url!: string;

    @ApiProperty({ type: String })
    last_page_url!: string;

    @ApiProperty({ type: String, nullable: true })
    next_page_url!: string | null;

    @ApiProperty({ type: String, nullable: true })
    prev_page_url!: string | null;

    @ApiProperty({ type: Number })
    from!: number;

    @ApiProperty({ type: Number })
    to!: number;
  }

  Object.defineProperty(Pagination, 'name', {
    writable: false,
    value: `InfinityPagination${classReference.name}ResponseDto`,
  });

  return Pagination;
}
