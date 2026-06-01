export interface JsonLdField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'date' | 'number' | 'array' | 'object' | 'select';
  required?: boolean;
  placeholder?: string;
  children?: JsonLdField[];
  options?: { value: string; label: string }[];
}

export interface JsonLdSchema {
  type: string;
  label: string;
  description: string;
  category: string;
  fields: JsonLdField[];
  parent?: string;
}

export const JSON_LD_SCHEMAS: JsonLdSchema[] = [
  // === Content ===
  {
    type: 'Article',
    label: 'Article',
    description: 'A news article, blog post, or report.',
    category: 'Contenido',
    fields: [
      { key: 'headline', label: 'Título', type: 'text', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'image', label: 'URL de imagen', type: 'url', required: true },
      { key: 'datePublished', label: 'Fecha publicación', type: 'date', required: true },
      { key: 'dateModified', label: 'Fecha modificación', type: 'date' },
      { key: 'author', label: 'Autor', type: 'object', children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'Person', label: 'Person' }, { value: 'Organization', label: 'Organization' }] },
        { key: 'name', label: 'Nombre', type: 'text', required: true },
        { key: 'url', label: 'URL', type: 'url' },
      ]},
      { key: 'publisher', label: 'Editor', type: 'object', children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'Organization', label: 'Organization' }] },
        { key: 'name', label: 'Nombre', type: 'text', required: true },
        { key: 'logo', label: 'Logo URL', type: 'url' },
      ]},
      { key: 'mainEntityOfPage', label: 'URL canónica', type: 'url' },
    ],
  },
  {
    type: 'NewsArticle',
    label: 'NewsArticle',
    description: 'A news article.',
    category: 'Contenido',
    parent: 'Article',
    fields: [
      { key: 'headline', label: 'Título', type: 'text', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'image', label: 'URL de imagen', type: 'url', required: true },
      { key: 'datePublished', label: 'Fecha publicación', type: 'date', required: true },
      { key: 'dateModified', label: 'Fecha modificación', type: 'date' },
      { key: 'author', label: 'Autor', type: 'object', children: [
        { key: 'name', label: 'Nombre', type: 'text', required: true },
      ]},
      { key: 'publisher', label: 'Editor', type: 'object', children: [
        { key: 'name', label: 'Nombre', type: 'text', required: true },
      ]},
    ],
  },
  {
    type: 'BlogPosting',
    label: 'BlogPosting',
    description: 'A blog post.',
    category: 'Contenido',
    parent: 'Article',
    fields: [
      { key: 'headline', label: 'Título', type: 'text', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'image', label: 'URL de imagen', type: 'url', required: true },
      { key: 'datePublished', label: 'Fecha publicación', type: 'date', required: true },
      { key: 'dateModified', label: 'Fecha modificación', type: 'date' },
      { key: 'author', label: 'Autor', type: 'object', children: [
        { key: 'name', label: 'Nombre', type: 'text', required: true },
      ]},
      { key: 'publisher', label: 'Editor', type: 'object', children: [
        { key: 'name', label: 'Nombre', type: 'text', required: true },
      ]},
    ],
  },

  // === Ecommerce ===
  {
    type: 'Product',
    label: 'Product',
    description: 'Any offered product or service.',
    category: 'Ecommerce',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'image', label: 'URL de imagen', type: 'url', required: true },
      { key: 'sku', label: 'SKU', type: 'text' },
      { key: 'mpn', label: 'MPN', type: 'text' },
      { key: 'brand', label: 'Marca', type: 'object', children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'Brand', label: 'Brand' }, { value: 'Organization', label: 'Organization' }] },
        { key: 'name', label: 'Nombre', type: 'text', required: true },
      ]},
      { key: 'offers', label: 'Oferta', type: 'object', required: true, children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'Offer', label: 'Offer' }, { value: 'AggregateOffer', label: 'AggregateOffer' }] },
        { key: 'price', label: 'Precio', type: 'number', required: true },
        { key: 'priceCurrency', label: 'Moneda', type: 'select', options: [
          { value: 'EUR', label: 'EUR' }, { value: 'USD', label: 'USD' }, { value: 'GBP', label: 'GBP' }, { value: 'ARS', label: 'ARS' },
        ], required: true },
        { key: 'availability', label: 'Disponibilidad', type: 'select', options: [
          { value: 'https://schema.org/InStock', label: 'En stock' },
          { value: 'https://schema.org/OutOfStock', label: 'Agotado' },
          { value: 'https://schema.org/PreOrder', label: 'Pre-order' },
        ]},
        { key: 'url', label: 'URL', type: 'url' },
      ]},
      { key: 'aggregateRating', label: 'Valoración', type: 'object', children: [
        { key: 'ratingValue', label: 'Puntuación', type: 'number' },
        { key: 'reviewCount', label: 'Nº reseñas', type: 'number' },
      ]},
    ],
  },

  // === FAQ ===
  {
    type: 'FAQPage',
    label: 'FAQ (Preguntas frecuentes)',
    description: 'A page with questions and answers.',
    category: 'Contenido',
    fields: [
      { key: 'mainEntity', label: 'Preguntas', type: 'array', required: true, children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'Question', label: 'Question' }] },
        { key: 'name', label: 'Pregunta', type: 'text', required: true },
        { key: 'acceptedAnswer', label: 'Respuesta', type: 'object', required: true, children: [
          { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'Answer', label: 'Answer' }] },
          { key: 'text', label: 'Texto', type: 'textarea', required: true },
        ]},
      ]},
    ],
  },

  // === HowTo ===
  {
    type: 'HowTo',
    label: 'HowTo (Tutorial)',
    description: 'A step-by-step tutorial.',
    category: 'Contenido',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'totalTime', label: 'Tiempo total', type: 'text', placeholder: 'PT30M' },
      { key: 'tool', label: 'Herramientas', type: 'array', children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'HowToTool', label: 'HowToTool' }] },
        { key: 'name', label: 'Nombre', type: 'text', required: true },
      ]},
      { key: 'supply', label: 'Materiales', type: 'array', children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'HowToSupply', label: 'HowToSupply' }] },
        { key: 'name', label: 'Nombre', type: 'text', required: true },
      ]},
      { key: 'step', label: 'Pasos', type: 'array', required: true, children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'HowToStep', label: 'HowToStep' }] },
        { key: 'name', label: 'Título', type: 'text' },
        { key: 'text', label: 'Instrucción', type: 'textarea', required: true },
      ]},
    ],
  },

  // === Local Business ===
  {
    type: 'LocalBusiness',
    label: 'LocalBusiness',
    description: 'A local business or store.',
    category: 'Negocio Local',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'image', label: 'URL de imagen', type: 'url' },
      { key: 'telephone', label: 'Teléfono', type: 'text' },
      { key: 'priceRange', label: 'Rango de precio', type: 'text', placeholder: '$' },
      { key: 'address', label: 'Dirección', type: 'object', required: true, children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'PostalAddress', label: 'PostalAddress' }] },
        { key: 'streetAddress', label: 'Calle', type: 'text', required: true },
        { key: 'addressLocality', label: 'Ciudad', type: 'text', required: true },
        { key: 'postalCode', label: 'Código postal', type: 'text', required: true },
        { key: 'addressCountry', label: 'País', type: 'text', required: true },
      ]},
      { key: 'geo', label: 'Coordenadas', type: 'object', children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'GeoCoordinates', label: 'GeoCoordinates' }] },
        { key: 'latitude', label: 'Latitud', type: 'number' },
        { key: 'longitude', label: 'Longitud', type: 'number' },
      ]},
      { key: 'openingHoursSpecification', label: 'Horarios', type: 'array', children: [
        { key: 'dayOfWeek', label: 'Día', type: 'text', placeholder: 'Monday' },
        { key: 'opens', label: 'Apertura', type: 'text', placeholder: '09:00' },
        { key: 'closes', label: 'Cierre', type: 'text', placeholder: '18:00' },
      ]},
    ],
  },

  // === Organization ===
  {
    type: 'Organization',
    label: 'Organization',
    description: 'An organization such as a company, NGO, or club.',
    category: 'Negocio Local',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', required: true },
      { key: 'url', label: 'URL', type: 'url', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'logo', label: 'Logo URL', type: 'url' },
      { key: 'sameAs', label: 'Redes sociales', type: 'array', children: [
        { key: 'url', label: 'URL', type: 'url', required: true },
      ]},
      { key: 'contactPoint', label: 'Contacto', type: 'object', children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'ContactPoint', label: 'ContactPoint' }] },
        { key: 'telephone', label: 'Teléfono', type: 'text', required: true },
        { key: 'contactType', label: 'Tipo de contacto', type: 'text', placeholder: 'customer service' },
      ]},
      { key: 'brand', label: 'Marca', type: 'object', children: [
        { key: 'name', label: 'Nombre', type: 'text' },
      ]},
    ],
  },

  // === Recipe ===
  {
    type: 'Recipe',
    label: 'Recipe',
    description: 'A recipe with ingredients and instructions.',
    category: 'Contenido',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'image', label: 'URL de imagen', type: 'url', required: true },
      { key: 'prepTime', label: 'Tiempo preparación', type: 'text', placeholder: 'PT15M' },
      { key: 'cookTime', label: 'Tiempo cocción', type: 'text', placeholder: 'PT30M' },
      { key: 'totalTime', label: 'Tiempo total', type: 'text', placeholder: 'PT45M' },
      { key: 'recipeYield', label: 'Porciones', type: 'text', placeholder: '4' },
      { key: 'recipeIngredient', label: 'Ingredientes', type: 'array', children: [
        { key: 'ingredient', label: 'Ingrediente', type: 'text', required: true },
      ]},
      { key: 'recipeInstructions', label: 'Instrucciones', type: 'array', children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'HowToStep', label: 'HowToStep' }] },
        { key: 'text', label: 'Paso', type: 'textarea', required: true },
      ]},
      { key: 'nutrition', label: 'Nutrición', type: 'object', children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'NutritionInformation', label: 'NutritionInformation' }] },
        { key: 'calories', label: 'Calorías', type: 'text' },
      ]},
    ],
  },

  // === Video ===
  {
    type: 'VideoObject',
    label: 'VideoObject',
    description: 'A video file or embed.',
    category: 'Multimedia',
    fields: [
      { key: 'name', label: 'Título', type: 'text', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea', required: true },
      { key: 'thumbnailUrl', label: 'Thumbnail URL', type: 'url', required: true },
      { key: 'contentUrl', label: 'URL del video', type: 'url' },
      { key: 'embedUrl', label: 'URL embed', type: 'url' },
      { key: 'uploadDate', label: 'Fecha subida', type: 'date', required: true },
      { key: 'duration', label: 'Duración', type: 'text', placeholder: 'PT2M30S' },
    ],
  },

  // === Event ===
  {
    type: 'Event',
    label: 'Event',
    description: 'An event happening at a certain time and location.',
    category: 'Multimedia',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'startDate', label: 'Fecha inicio', type: 'date', required: true },
      { key: 'endDate', label: 'Fecha fin', type: 'date' },
      { key: 'location', label: 'Ubicación', type: 'object', required: true, children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [
          { value: 'Place', label: 'Place' }, { value: 'VirtualLocation', label: 'VirtualLocation' },
        ]},
        { key: 'name', label: 'Nombre', type: 'text' },
        { key: 'address', label: 'Dirección', type: 'text' },
      ]},
      { key: 'offers', label: 'Entradas', type: 'array', children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'Offer', label: 'Offer' }] },
        { key: 'url', label: 'URL', type: 'url' },
        { key: 'price', label: 'Precio', type: 'number' },
      ]},
      { key: 'performer', label: 'Artistas/Ponentes', type: 'array', children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'Person', label: 'Person' }, { value: 'Organization', label: 'Organization' }] },
        { key: 'name', label: 'Nombre', type: 'text', required: true },
      ]},
    ],
  },

  // === Breadcrumb ===
  {
    type: 'BreadcrumbList',
    label: 'BreadcrumbList',
    description: 'A breadcrumb trail for navigation.',
    category: 'Guiado',
    fields: [
      { key: 'itemListElement', label: 'Elementos', type: 'array', required: true, children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'ListItem', label: 'ListItem' }] },
        { key: 'position', label: 'Posición', type: 'number', required: true },
        { key: 'name', label: 'Nombre', type: 'text', required: true },
        { key: 'item', label: 'URL', type: 'url', required: true },
      ]},
    ],
  },

  // === Course ===
  {
    type: 'Course',
    label: 'Course',
    description: 'An educational course.',
    category: 'Contenido',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea', required: true },
      { key: 'provider', label: 'Proveedor', type: 'object', children: [
        { key: 'name', label: 'Nombre', type: 'text' },
      ]},
    ],
  },

  // === Person ===
  {
    type: 'Person',
    label: 'Person',
    description: 'A person (alive, dead, fictional).',
    category: 'Entidades',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', required: true },
      { key: 'jobTitle', label: 'Cargo', type: 'text' },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'image', label: 'URL de imagen', type: 'url' },
      { key: 'sameAs', label: 'Redes sociales', type: 'array', children: [
        { key: 'url', label: 'URL', type: 'url', required: true },
      ]},
      { key: 'url', label: 'URL', type: 'url' },
    ],
  },

  // === WebSite ===
  {
    type: 'WebSite',
    label: 'WebSite',
    description: 'A website with optional Sitelinks Searchbox.',
    category: 'Entidades',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', required: true },
      { key: 'url', label: 'URL', type: 'url', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'publisher', label: 'Editor', type: 'object', children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'Organization', label: 'Organization' }] },
        { key: 'name', label: 'Nombre', type: 'text' },
        { key: 'url', label: 'URL', type: 'url' },
      ]},
    ],
  },

  // === Software ===
  {
    type: 'SoftwareApplication',
    label: 'SoftwareApplication',
    description: 'A software application.',
    category: 'Ecommerce',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'applicationCategory', label: 'Categoría', type: 'text' },
      { key: 'operatingSystem', label: 'Sistema operativo', type: 'text' },
      { key: 'offers', label: 'Oferta', type: 'object', required: true, children: [
        { key: '@type', label: 'Tipo', type: 'select', options: [{ value: 'Offer', label: 'Offer' }] },
        { key: 'price', label: 'Precio', type: 'number', required: true },
        { key: 'priceCurrency', label: 'Moneda', type: 'select', options: [
          { value: 'EUR', label: 'EUR' }, { value: 'USD', label: 'USD' },
        ], required: true },
      ]},
    ],
  },
];

export function getSchemaByType(type: string): JsonLdSchema | undefined {
  return JSON_LD_SCHEMAS.find((s) => s.type === type);
}

export function getSchemasByCategory(): Record<string, JsonLdSchema[]> {
  const cats: Record<string, JsonLdSchema[]> = {};
  for (const s of JSON_LD_SCHEMAS) {
    if (!cats[s.category]) cats[s.category] = [];
    cats[s.category]!.push(s);
  }
  return cats;
}
