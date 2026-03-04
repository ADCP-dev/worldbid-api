---
inject: true
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/entities/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.entity.ts
after: export class <%= name %>Entity
---

<% if (kind === 'primitive') { -%>
  <% if (type === 'text') { -%>
  @Column({ type: 'text', nullable: <%= isNullable %> })
  <% } else if (type === 'decimal') { -%>
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: <%= isNullable %> })
  <% } else if (type === 'timestamp') { -%>
  @Column({ type: 'timestamp', nullable: <%= isNullable %> })
  <% } else if (type === 'uuid') { -%>
  @Column({ type: 'uuid', nullable: <%= isNullable %> })
  <% } else if (type === 'json' || type === 'jsonb') { -%>
  @Column({ type: 'jsonb', nullable: <%= isNullable %> })
  <% } else if (type === 'array') { -%>
  @Column({ type: 'simple-array', nullable: <%= isNullable %> })
  <% } else if (type === 'enum') { -%>
  @Column({ type: 'enum', nullable: <%= isNullable %> })
  <% } else { -%>
  @Column({
    nullable: <%= isNullable %>,
    type:
      <% if (type === 'string') { -%>
        String,
      <% } else if (type === 'number') { -%>
        Number,
      <% } else if (type === 'boolean') { -%>
        Boolean,
      <% } else if (type === 'Date') { -%>
        Date,
      <% } -%>
  })
  <% } -%>
<% } -%>

<% if (kind === 'duplication') { -%>
  @Column({
    nullable: <%= isNullable %>,
    type: 'jsonb',
  })
<% } -%>

<% if (kind === 'reference') { -%>
  <% if (referenceType === 'oneToOne') { -%>
    @OneToOne(() => <%= type %>Entity, { eager: true, nullable: <%= isNullable %> })
  <% } else if (referenceType === 'oneToMany') { -%>
    @OneToMany(() => <%= type %>Entity, (childEntity) => childEntity.<%= propertyInReference %>, { eager: true, nullable: <%= isNullable %> })
  <% } else if (referenceType === 'manyToOne') { -%>
    @ManyToOne(
      () => <%= type %>Entity,
      <% if (propertyInReference) { -%>
        (parentEntity) => parentEntity.<%= propertyInReference %>,
      <% } -%>
      { eager: <% if (propertyInReference) { -%>false<% } else { -%>true<% } -%>, nullable: <%= isNullable %> }
    )
  <% } else if (referenceType === 'manyToMany') { -%>
    @ManyToMany(() => <%= type %>Entity, { eager: true, nullable: <%= isNullable %> })
  <% } -%>

  <% if (referenceType === 'oneToOne') { -%>
    @JoinColumn()
  <% } -%>

  <% if (referenceType === 'manyToMany') { -%>
    @JoinTable()
  <% } -%>

  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: <%= type %>Entity<% if (referenceType === 'oneToMany' || referenceType === 'manyToMany') { -%>[]<% } -%> <% if (isNullable) { -%> | null<% } -%>;
<% } else if (kind === 'duplication') { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: <%= type %>Entity<% if (referenceType === 'oneToMany' || referenceType === 'manyToMany') { -%>[]<% } -%> <% if (isNullable) { -%> | null<% } -%>;
<% } else if (kind === 'primitive') { -%>
  <% if (type === 'json' || type === 'jsonb') { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: object <% if (isNullable) { -%> | null<% } -%>;
  <% } else if (type === 'array') { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: string <% if (isNullable) { -%> | null<% } -%>;
  <% } else if (type === 'enum') { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: string <% if (isNullable) { -%> | null<% } -%>;
  <% } else { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: <%= type %> <% if (isNullable) { -%> | null<% } -%>;
  <% } -%>
<% } else { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: <%= type %> <% if (isNullable) { -%> | null<% } -%>;
<% } -%>


