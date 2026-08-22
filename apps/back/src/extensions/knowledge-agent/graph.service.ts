import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { NoteRepository } from './infrastructure/note.repository';
import { GraphData, GraphEdge, GraphNode } from './domain/graph';

@Injectable()
export class GraphService {
  constructor(private readonly repository: NoteRepository) {}

  /**
   * Build the GLOBAL knowledge graph (all notes shared across users).
   *
   * degree = number of edges touching the node (in + out). Nodes with no
   * links have degree 0 (isolated).
   */
  async getGraph(
    filters?: { categoryPath?: string; tag?: string },
  ): Promise<GraphData> {
    const notes = await this.repository.findNotesForGraph(filters);

    const noteIds = notes.map((n) => n.id);
    const linkRows = await this.repository.findLinksForNotes(noteIds);

    const degree = new Map<string, number>();
    for (const id of noteIds) degree.set(id, 0);
    for (const row of linkRows) {
      degree.set(row.source_note_id, (degree.get(row.source_note_id) ?? 0) + 1);
      degree.set(row.target_note_id, (degree.get(row.target_note_id) ?? 0) + 1);
    }

    const nodes: GraphNode[] = notes.map((n) => ({
      id: n.id,
      label: n.title,
      tags: n.tags,
      categoryPath: n.category_path,
      degree: degree.get(n.id) ?? 0,
    }));

    const edges: GraphEdge[] = linkRows.map((row) => ({
      source: row.source_note_id,
      target: row.target_note_id,
    }));

    return plainToInstance(
      GraphData,
      { nodes, edges },
      { excludeExtraneousValues: true },
    );
  }
}