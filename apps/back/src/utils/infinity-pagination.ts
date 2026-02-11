import { IPaginationOptions } from './types/pagination-options';
import { InfinityPaginationResponseDto } from './dto/infinity-pagination-response.dto';

export const infinityPagination = <T>(
  data: T[],
  options: IPaginationOptions,
  totalCount: number,
  filters: Record<string, any>,
  baseUrl?: string,
): InfinityPaginationResponseDto<T> => {
  const page = options.page || 1;
  const limit = options.limit;
  const lastPage = Math.ceil(totalCount / limit);
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, totalCount);
  const filtersString = Object.entries(filters)
    .map(([key, value]) => `&filter[${key}]=${value}`)
    .join('');
  const buildUrl = (pageNum: number) => {
    const queryString = `?page=${pageNum}${filtersString}`;
    return baseUrl ? `${baseUrl}${queryString}` : queryString;
  };
  return {
    total: totalCount,
    per_page: limit,
    current_page: page,
    last_page: lastPage,
    first_page_url: buildUrl(1),
    last_page_url: buildUrl(lastPage),
    next_page_url: page < lastPage ? buildUrl(page + 1) : null,
    prev_page_url: page > 1 ? buildUrl(page - 1) : null,
    from,
    to,
    data,
  };
};
