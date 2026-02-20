import { 
  // common
  Injectable,
} from '@nestjs/common';
import { CreateTestExtensionDto } from './dto/create-test-extension.dto';
import { UpdateTestExtensionDto } from './dto/update-test-extension.dto';
import { TestExtensionRepository } from './infrastructure/test-extension.repository';
import { IPaginationOptions } from '../../utils/types/pagination-options';
import { TestExtension } from './domain/test-extension';
import { infinityPagination } from '../../utils/infinity-pagination';
import { InfinityPaginationResponseDto } from '../../utils/dto/infinity-pagination-response.dto';
import { FindAllTestExtensionsDto } from './dto/find-all-test-extensions.dto';
import { FindAllTestExtensionsPaginatedDto } from './dto/find-all-test-extensions-paginated.dto';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../../config/config.type';

@Injectable()
export class TestExtensionsService {
  constructor(
    // Dependencies here
    private readonly testExtensionRepository: TestExtensionRepository,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async create(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    createTestExtensionDto: CreateTestExtensionDto
  ) {
    // Do not remove comment below.
    // <creating-property />

    return this.testExtensionRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
    });
  }

  findById(id: TestExtension['id']) {
    return this.testExtensionRepository.findById(id);
  }

  findByIds(ids: TestExtension['id'][]) {
    return this.testExtensionRepository.findByIds(ids);
  }

  countAll(filters: Record<string, any>): Promise<number> {
    return this.testExtensionRepository.countAll(filters);
  }

  findAll(query: FindAllTestExtensionsDto): Promise<TestExtension[]> {
    return this.testExtensionRepository.findAll({ filters: query.filter });
  }

  async findAllWithPagination(
    query: FindAllTestExtensionsPaginatedDto,
  ): Promise<InfinityPaginationResponseDto<TestExtension>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 100) {
      limit = 100;
    }

    // Extract filters from the query if they exist
    const filters = query.filter || {};

    // Get the data with pagination and filters
    const TestExtensions = await this.testExtensionRepository.findAllWithPagination({
      paginationOptions: {
        page,
        limit,
      },
      filters,
    });

    // Count total records with the same filters
    const totalCount = await this.countAll(filters);

    const backendDomain = this.configService.getOrThrow('app.backendDomain', {
      infer: true,
    });
    const baseUrl = `${backendDomain}${query.originalUrl}`;

    return infinityPagination(TestExtensions, { page, limit }, totalCount, filters, baseUrl);
  }

  async update(
    id: TestExtension['id'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateTestExtensionDto: UpdateTestExtensionDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    return this.testExtensionRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
    });
  }

  remove(id: TestExtension['id']) {
    return this.testExtensionRepository.remove(id);
  }
}
