import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { NoteService } from './note.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { QueryNoteDto } from './dto/query-note.dto';
import { Note } from './domain/note';
import { JwtAuth } from '@iam/auth/decorators/auth.decorator';
import { UserId } from '@iam/auth/decorators/current-user.decorator';
import { AuthGuard } from '@nestjs/passport';
import { UseGuards } from '@nestjs/common';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';

@ApiTags('Knowledge Notes')
@JwtAuth()
@Controller({
  path: 'ka/notes',
  version: '1',
})
export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  @Post()
  @ApiCreatedResponse({ type: Note })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateNoteDto, @UserId() userId: number): Promise<Note> {
    // Notes are global; userId is stored as creator provenance only.
    return this.noteService.create({ ...dto, userId });
  }

  @Get()
  @ApiOkResponse({ type: [Note] })
  findAll(@Query() query: QueryNoteDto): Promise<Note[]> {
    if (query.categoryPath) {
      return this.noteService.findByCategoryPath(
        query.categoryPath,
        query.depth ?? 0,
      );
    }
    return this.noteService.findAll({ search: query.search });
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: Note })
  async findById(@Param('id') id: string): Promise<Note | null> {
    return this.noteService.findById(id);
  }

  @Get(':id/backlinks')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: [Note] })
  async findBacklinks(@Param('id') id: string): Promise<Note[]> {
    return this.noteService.findBacklinks(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: Note })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
  ): Promise<Note> {
    return this.noteService.update(id, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.noteService.softDelete(id);
  }

  /**
   * Rename a category folder: updates category_path on all notes whose
   * path equals `oldPath` or starts with `oldPath.`. Useful when the user
   * renames a folder in the tree UI.
   */
  @Patch('categories/rename')
  @ApiOkResponse({ type: Number })
  async renameCategory(
    @Body() body: { oldPath: string; newPath: string },
  ): Promise<number> {
    return this.noteService.renameCategory(body.oldPath, body.newPath);
  }

  /**
   * Delete a category folder: moves all notes in that folder (and its
   * subfolders) to "uncategorized" (category_path = null). Notes themselves
   * are NOT deleted — only the folder grouping is removed.
   */
  @Delete('categories/:path')
  @ApiParam({ name: 'path', type: String })
  @HttpCode(HttpStatus.OK)
  async deleteCategory(@Param('path') path: string): Promise<number> {
    return this.noteService.deleteCategory(path);
  }

  /**
   * Re-queue embedding jobs for every note. Admin-only. Call after
   * (re)configuring the embeddings provider so semantic search covers
   * pre-existing notes (new/updated notes embed automatically).
   */
  @Post('reindex')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiOkResponse({ type: Number })
  @HttpCode(HttpStatus.OK)
  async reindex(): Promise<number> {
    return this.noteService.reindexEmbeddings();
  }

  /**
   * Re-extract wikilinks for every note and rebuild note-link edges.
   * Admin-only. Repairs the graph for historic data: forward references
   * that never resolved, entity-encoded titles, case mismatches.
   */
  @Post('reindex-links')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiOkResponse({ type: Number })
  @HttpCode(HttpStatus.OK)
  async reindexLinks(): Promise<number> {
    return this.noteService.reindexLinks();
  }
}
