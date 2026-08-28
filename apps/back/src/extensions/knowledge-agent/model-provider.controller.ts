import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ModelProviderRepository } from './infrastructure/model-provider.repository';
import { CreateModelProviderDto } from './dto/create-model-provider.dto';
import { UpdateModelProviderDto } from './dto/update-model-provider.dto';
import { ModelProvider } from './domain/model-provider';
import { JwtAuth } from '@iam/auth/decorators/auth.decorator';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';

interface RemoteModel {
  id: string;
  name: string;
  /** Input modalities the model accepts: text, image, file (PDF), audio. */
  modalities: string[];
}

/** TTL cache for remote model lists (provider APIs are slow + rate-limited). */
interface CachedModels {
  models: RemoteModel[];
  fetchedAt: number;
}

/**
 * Model providers are an admin-managed registry.
 *
 * - GET (list/inspect): any authenticated user (needed to populate the
 *   agent-config model select and to display provider names in the UI).
 * - POST/PATCH/DELETE (mutations): admin only. RBAC enforced via
 *   `@Roles(RoleEnum.admin)` + `RolesGuard`, matching the Foundation pattern
 *   used by the Stripe extension (e.g. ProductsController).
 */
@ApiTags('Knowledge Model Providers')
@JwtAuth()
@Controller({
  path: 'ka/model-providers',
  version: '1',
})
export class ModelProviderController {
  constructor(private readonly repository: ModelProviderRepository) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiCreatedResponse({ type: ModelProvider })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateModelProviderDto): Promise<ModelProvider> {
    return this.repository.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: [ModelProvider] })
  findAll(): Promise<ModelProvider[]> {
    return this.repository.find();
  }

  /**
   * Input modalities for a given agent model string ("prefix:modelId").
   *
   * The chat UI calls this to unlock/lock attachment types (images, PDFs,
   * audio) depending on what the selected model can read. Resolves the
   * provider by prefix, fetches its remote model list (5-min TTL cache),
   * and returns the matched model's modalities. Falls back to ['text'].
   */
  @Get('capabilities')
  @ApiOkResponse({ type: Object })
  async capabilities(@Query('model') model: string): Promise<{ modalities: string[] }> {
    if (!model) return { modalities: ['text'] };
    const idx = model.indexOf(':');
    const prefix = idx === -1 ? model : model.slice(0, idx);
    const modelId = idx === -1 ? model : model.slice(idx + 1);

    const provider = await this.repository.findByProvider(prefix);
    if (!provider) return { modalities: ['text'] };

    const models = await this.fetchProviderModelsCached(provider.id);
    const found = models.find((m) => m.id === modelId);
    return { modalities: found?.modalities ?? ['text'] };
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: ModelProvider })
  findById(@Param('id') id: string): Promise<ModelProvider | null> {
    return this.repository.findById(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: ModelProvider })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateModelProviderDto,
  ): Promise<ModelProvider> {
    return this.repository.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiParam({ name: 'id', type: String })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.repository.remove(id);
  }

  /**
   * Fetch available models from the provider's remote API (server-side
   * proxy). The frontend can't call ollama.com/openrouter.ai directly due to
   * CORS, so this endpoint does the fetch and returns the model list with
   * their input modalities (used to unlock attachment types in the chat UI).
   *
   * Supported providers:
   *   - ollama / ollama-cloud: GET {baseUrl}/api/tags
   *   - openrouter / openai: GET {baseUrl}/models
   */
  @Get(':id/models')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: Array })
  async fetchModels(@Param('id') id: string): Promise<RemoteModel[]> {
    const provider = await this.repository.findById(id);
    if (!provider) return [];
    return this.fetchProviderModelsCached(provider.id);
  }

  /** 5-minute TTL cache so the chat page + settings page don't hammer APIs. */
  private readonly modelsCache = new Map<string, CachedModels>();
  private static readonly MODELS_TTL_MS = 5 * 60 * 1000;

  private async fetchProviderModelsCached(providerId: string): Promise<RemoteModel[]> {
    const cached = this.modelsCache.get(providerId);
    if (cached && Date.now() - cached.fetchedAt < ModelProviderController.MODELS_TTL_MS) {
      return cached.models;
    }
    const provider = await this.repository.findById(providerId);
    if (!provider) return [];

    // Resolve API key: env var first, literal value as fallback.
    const apiKey = provider.apiKeyRef
      ? (process.env[provider.apiKeyRef] ?? provider.apiKeyRef)
      : undefined;

    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    let models: RemoteModel[] = [];

    if (provider.provider === 'ollama' || provider.provider === 'ollama-cloud') {
      // Strip trailing /api so we don't get /api/api/tags
      let baseUrl = (provider.baseUrl || 'http://127.0.0.1:11434').replace(/\/$/, '');
      baseUrl = baseUrl.replace(/\/api\/?$/, '');
      const resp = await fetch(`${baseUrl}/api/tags`, { headers });
      if (resp.ok) {
        const data = await resp.json() as {
          models?: Array<{
            name: string;
            details?: { parameter_size?: string; families?: string[] | null };
          }>;
        };
        models = (data.models ?? []).map((m) => {
          // Multimodal Ollama models carry a 'clip' vision encoder family
          // (llava, llama3.2-vision, qwen2-vl, minicpm-v…).
          const families = m.details?.families ?? [];
          const vision = families.some((f) => f.toLowerCase() === 'clip');
          return {
            id: m.name,
            name: m.details?.parameter_size ? `${m.name} (${m.details.parameter_size})` : m.name,
            modalities: vision ? ['text', 'image'] : ['text'],
          };
        });
      }
    } else if (provider.provider === 'openrouter' || provider.provider === 'openai') {
      const baseUrl = (provider.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
      const resp = await fetch(`${baseUrl}/models`, { headers });
      if (resp.ok) {
        const data = await resp.json() as {
          data?: Array<{
            id: string;
            name?: string;
            architecture?: { input_modalities?: string[] };
          }>;
        };
        models = (data.data ?? []).map((m) => ({
          id: m.id,
          name: m.name ?? m.id,
          modalities: m.architecture?.input_modalities?.length
            ? m.architecture.input_modalities
            : ['text'],
        }));
      }
    }

    this.modelsCache.set(providerId, { models, fetchedAt: Date.now() });
    return models;
  }
}