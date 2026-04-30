# TypeORM — Reference

## Entity Definition

```typescript
@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

## Primary Keys

| Type | Decorator |
|------|-----------|
| Auto-increment | `@PrimaryGeneratedColumn()` |
| UUID | `@PrimaryGeneratedColumn('uuid')` |
| Custom | `@PrimaryColumn()` |
| Composite | Multiple `@PrimaryColumn()` |

## Column Types

```typescript
@Column({ type: 'varchar', length: 255 })           // String
@Column({ type: 'text', nullable: true })             // Text
@Column({ type: 'decimal', precision: 10, scale: 2 }) // Decimal
@Column({ type: 'int', default: 0 })                  // Integer
@Column({ type: 'boolean', default: true })           // Boolean
@Column({ type: 'jsonb', nullable: true })            // JSON
@Column({ type: 'enum', enum: ['a','b'], default: 'a' }) // Enum
@CreateDateColumn()                                    // Created at
@UpdateDateColumn()                                    // Updated at
@DeleteDateColumn()                                    // Soft delete
@VersionColumn()                                       // Optimistic locking
```

## Relations

```typescript
// One-to-One
@OneToOne(() => Profile, (p) => p.user, { cascade: true })
@JoinColumn()
profile: Profile;

// Many-to-One (owning side — has FK)
@ManyToOne(() => User, (u) => u.posts, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'author_id' })
author: User;
@Column() authorId: number;  // Explicit FK

// One-to-Many (inverse side)
@OneToMany(() => Post, (p) => p.author)
posts: Post[];

// Many-to-Many
@ManyToMany(() => Tag, (t) => t.posts)
@JoinTable({ name: 'post_tags', joinColumn: { name: 'post_id' }, inverseJoinColumn: { name: 'tag_id' } })
tags: Tag[];
```

## Repository

```typescript
const repo = AppDataSource.getRepository(User);
await repo.find({ where: { isActive: true }, relations: ['posts'] });
await repo.findOne({ where: { id } });
await repo.findOneOrFail({ where: { id } });
await repo.save(repo.create({ email: 'a@b.com' }));
await repo.update({ id }, { name: 'New' });
await repo.delete({ id });
await repo.softDelete({ id });  // requires @DeleteDateColumn
```

### QueryBuilder

```typescript
repo.createQueryBuilder('user')
  .leftJoinAndSelect('user.posts', 'post')
  .where('user.isActive = :active', { active: true })
  .andWhere('post.publishedAt IS NOT NULL')
  .orderBy('user.createdAt', 'DESC')
  .skip(0).take(10)
  .getMany();

// Raw result
repo.createQueryBuilder('user')
  .select('COUNT(*)', 'count')
  .getRawOne();
```

## Migrations

```bash
pnpm migration:generate AddXxx    # From entity changes
pnpm migration:run                # Apply pending
pnpm migration:revert             # Rollback last
```

## Transactions

```typescript
// DataSource.transaction (auto rollback)
await AppDataSource.transaction(async (manager) => {
  await manager.save(User, data);
  await manager.save(Profile, profileData);
});

// QueryRunner (manual control)
const qr = AppDataSource.createQueryRunner();
await qr.connect();
await qr.startTransaction();
try {
  await qr.manager.save(User, data);
  await qr.commitTransaction();
} catch (err) {
  await qr.rollbackTransaction();
} finally {
  await qr.release();
}
```

## Indexes

```typescript
@Entity()
@Index(['email'])
@Index(['firstName', 'lastName'])
export class UserEntity {
  @Column()
  @Index()
  email: string;
}
```

## Naming Strategy (snake_case)

```typescript
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
// In config: namingStrategy: new SnakeNamingStrategy(),
```
