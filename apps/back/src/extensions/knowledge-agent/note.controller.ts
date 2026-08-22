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
import { ApiOkResponse, ApiParam, ApiTags, ApiCreatedResponse } from '@nestjs/swagger';
import { NoteService } from './note.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { QueryNoteDto } from './dto/query-note.dto';
import { Note } from './domain/note';
import { JwtAuth } from '@iam/auth/decorators/auth.decorator';
import { UserId } from '@iam/auth/decorators/current-user.decorator';

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
  create(
    @Body() dto: CreateNoteDto,
    @UserId() userId: number,
  ): Promise<Note> {
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
}