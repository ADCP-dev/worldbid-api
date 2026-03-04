---
inject: true
to: src/custom/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/mappers/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.mapper.ts
after: // <mapping-properties-update />
---
<% if (kind === 'primitive') { -%>
  if (data.<%= property %> !== undefined) {
    persistenceEntity.<%= property %> = data.<%= property %>;
  }
<% } else if (kind === 'reference') { -%>
  <% if (referenceType === 'oneToMany' || referenceType === 'manyToMany') { -%>
  if (data.<%= property %>Ids && data.<%= property %>Ids.length > 0) {
    persistenceEntity.<%= property %> = data.<%= property %>Ids.map((id: string) => {
      const <%= h.inflection.camelize(type, true) %> = new <%= type %>Entity();
      <%= h.inflection.camelize(type, true) %>.id = id;
      return <%= h.inflection.camelize(type, true) %>;
    });
  }
  <% } else { -%>
  if (data.<%= property %>Id) {
    const <%= h.inflection.camelize(property, true) %> = new <%= type %>Entity();
    <%= h.inflection.camelize(property, true) %>.id = data.<%= property %>Id;
    persistenceEntity.<%= property %> = <%= h.inflection.camelize(property, true) %>;
  }
  <% } -%>
<% } -%>
