import { NoteRepository } from './note.repository';

/**
 * Focused spec for wikilink resolution in {@link NoteRepository.upsertLinks}
 * and the forward-reference candidate query.
 *
 * TypeORM query builders are stubbed with chained mocks: select-type lookups
 * resolve via a shared `getOne` result queue (resolution is sequential), and
 * mutation builders are captured to assert resolved edges and query params.
 */
describe('NoteRepository link resolution', () => {
  let repository: NoteRepository;
  let selectQbs: Array<Record<string, jest.Mock>>;
  let insertQbs: Array<Record<string, jest.Mock>>;
  let getOneResults: unknown[];
  let getManyResults: unknown[];

  const createSelectQb = () => {
    const qb: Record<string, jest.Mock> = {
      select: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      getOne: jest.fn(),
      getMany: jest.fn(),
    };
    qb.select.mockReturnValue(qb);
    qb.where.mockReturnValue(qb);
    qb.andWhere.mockReturnValue(qb);
    qb.getOne.mockImplementation(() =>
      Promise.resolve(getOneResults.shift() ?? null),
    );
    qb.getMany.mockImplementation(() =>
      Promise.resolve(getManyResults.shift() ?? []),
    );
    return qb;
  };

  const createMutationQb = () => {
    const qb: Record<string, jest.Mock> = {};
    for (const method of [
      'delete',
      'from',
      'where',
      'insert',
      'into',
      'values',
      'orIgnore',
    ]) {
      qb[method] = jest.fn().mockReturnValue(qb);
    }
    qb.execute = jest.fn().mockResolvedValue(undefined);
    return qb;
  };

  const buildRepository = () => {
    const noteRepo = {
      createQueryBuilder: jest.fn(() => {
        const qb = createSelectQb();
        selectQbs.push(qb);
        return qb;
      }),
    };
    const dataSource = {
      createQueryBuilder: jest.fn(() => {
        const qb = createMutationQb();
        insertQbs.push(qb);
        return qb;
      }),
    };
    repository = new NoteRepository(noteRepo as never, dataSource as never);
  };

  beforeEach(() => {
    selectQbs = [];
    insertQbs = [];
    getOneResults = [];
    getManyResults = [];
  });

  describe('upsertLinks resolution order', () => {
    it('should match a dotted ref via the full-raw-string fallback', async () => {
      buildRepository();
      // (1) path "Node" + leaf "js" misses; (2) full raw "Node.js" hits.
      getOneResults.push(null, { id: 'target-1' });

      await repository.upsertLinks('src-1', ['Node.js']);

      expect(selectQbs[0].where).toHaveBeenCalledWith(
        'LOWER(note.title) = LOWER(:title)',
        {
          title: 'js',
        },
      );
      expect(selectQbs[0].andWhere).toHaveBeenCalledWith(
        'note.categoryPath = :path',
        {
          path: 'Node',
        },
      );
      // Second attempt uses the FULL raw ref as the title, not the split leaf.
      expect(selectQbs[1].where).toHaveBeenCalledWith(
        'LOWER(note.title) = LOWER(:title)',
        {
          title: 'node.js',
        },
      );
      expect(selectQbs).toHaveLength(2);
      expect(insertQbs[0].values).toHaveBeenCalledWith({
        sourceNoteId: 'src-1',
        targetNoteId: 'target-1',
      });
    });

    it('should match path + leaf title first and stop on first hit', async () => {
      buildRepository();
      getOneResults.push({ id: 'target-2' });

      await repository.upsertLinks('src-1', ['tech/notes/async']);

      expect(selectQbs).toHaveLength(1);
      expect(selectQbs[0].where).toHaveBeenCalledWith(
        'LOWER(note.title) = LOWER(:title)',
        {
          title: 'async',
        },
      );
      expect(selectQbs[0].andWhere).toHaveBeenCalledWith(
        'note.categoryPath = :path',
        {
          path: 'tech.notes',
        },
      );
      expect(insertQbs[0].values).toHaveBeenCalledWith({
        sourceNoteId: 'src-1',
        targetNoteId: 'target-2',
      });
    });

    it('should fall back to the leaf title when path and full-raw lookups miss', async () => {
      buildRepository();
      getOneResults.push(null, null, { id: 'target-3' });

      await repository.upsertLinks('src-1', ['tech.async']);

      expect(selectQbs).toHaveLength(3);
      expect(selectQbs[2].where).toHaveBeenCalledWith(
        'LOWER(note.title) = LOWER(:title)',
        {
          title: 'async',
        },
      );
      expect(insertQbs[0].values).toHaveBeenCalledWith({
        sourceNoteId: 'src-1',
        targetNoteId: 'target-3',
      });
    });

    it('should normalize titles: trim, collapse whitespace, case-insensitive', async () => {
      buildRepository();
      getOneResults.push({ id: 'target-4' });

      await repository.upsertLinks('src-1', ['  My   NOTE  ']);

      expect(selectQbs[0].where).toHaveBeenCalledWith(
        'LOWER(note.title) = LOWER(:title)',
        {
          title: 'my note',
        },
      );
      expect(insertQbs[0].values).toHaveBeenCalledWith({
        sourceNoteId: 'src-1',
        targetNoteId: 'target-4',
      });
    });

    it('should skip resolving a note to itself', async () => {
      buildRepository();
      getOneResults.push({ id: 'src-1' });

      await repository.upsertLinks('src-1', ['Solo']);

      expect(insertQbs).toHaveLength(0);
    });

    it('should not insert anything when nothing matches', async () => {
      buildRepository();

      await repository.upsertLinks('src-1', ['Ghost Note']);

      expect(selectQbs).toHaveLength(1);
      expect(insertQbs).toHaveLength(0);
    });
  });

  describe('findNotesContainingWikilinks', () => {
    it('should select only non-deleted notes whose content contains wikilinks', async () => {
      buildRepository();
      getManyResults.push([
        { id: 'n1', title: 'A', contentMd: '<p>see [[B]]</p>' },
        { id: 'n2', title: 'B', contentMd: '<p>plain</p>' },
      ]);

      const result = await repository.findNotesContainingWikilinks();

      expect(selectQbs[0].where).toHaveBeenCalledWith('note.deletedAt IS NULL');
      expect(selectQbs[0].andWhere).toHaveBeenCalledWith(
        'note.contentMd ~ :pattern',
        {
          pattern: '\\[\\[',
        },
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('n1');
      expect(result[0].title).toBe('A');
    });
  });
});
