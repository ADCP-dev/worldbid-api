import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogPostEntity } from '@ext/cms/blog/posts/infrastructure/entities/blog-post.entity';
import { TagEntity } from '@ext/cms/blog/posts/infrastructure/entities/post-tag.entity';
import { BlogCategoryEntity } from '@ext/cms/blog/categories/infrastructure/entities/blog-category.entity';
import { TranslationEntity } from '@src/modules/translations/infrastructure/entities/translation.entity';
import { LangEntity } from '@src/modules/translations/infrastructure/entities/lang.entity';
import { UserEntity } from '@users/infrastructure/entities/user.entity';

const POST_ID = '11111111-1111-1111-1111-111111111111';
const CATEGORY_ID = '22222222-2222-2222-2222-222222222222';
const TAGS = {
  contenido: '33333333-3333-3333-3333-333333333333',
  demo: '44444444-4444-4444-4444-444444444444',
  foundation: '55555555-5555-5555-5555-555555555555',
};

@Injectable()
export class BlogSeedService {
  private readonly logger = new Logger(BlogSeedService.name);

  constructor(
    @InjectRepository(BlogPostEntity)
    private readonly postRepository: Repository<BlogPostEntity>,
    @InjectRepository(BlogCategoryEntity)
    private readonly categoryRepository: Repository<BlogCategoryEntity>,
    @InjectRepository(TagEntity)
    private readonly tagRepository: Repository<TagEntity>,
    @InjectRepository(TranslationEntity)
    private readonly translationRepository: Repository<TranslationEntity>,
    @InjectRepository(LangEntity)
    private readonly langRepository: Repository<LangEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async run() {
    const lang = await this.ensureLang('es', 'Español');
    const author = await this.userRepository.findOne({
      where: { email: 'admin@example.com' },
      withDeleted: true,
    });

    const category = await this.ensureCategory({
      id: CATEGORY_ID,
      slug: 'pruebas',
      name: 'Pruebas',
    });

    const tags = await this.ensureTags([
      { id: TAGS.contenido, slug: 'contenido', name: 'Contenido' },
      { id: TAGS.demo, slug: 'demo', name: 'Demo' },
      { id: TAGS.foundation, slug: 'foundation', name: 'Foundation' },
    ]);

    let post = await this.postRepository.findOne({
      where: { slug: 'post-de-prueba-tipos-de-contenido' },
      relations: ['tags'],
    });

    if (!post) {
      post = this.postRepository.create({
        id: POST_ID,
        slug: 'post-de-prueba-tipos-de-contenido',
        isPublished: true,
        publishedAt: new Date('2026-08-24T12:00:00Z'),
        category,
        author: author || undefined,
        authorId: author?.id,
        tags,
      });
      post = await this.postRepository.save(post);
      this.logger.log('Created demo blog post');
    } else {
      post.isPublished = true;
      post.publishedAt = post.publishedAt || new Date('2026-08-24T12:00:00Z');
      post.category = category;
      post.tags = tags;
      post.author = author || post.author;
      post.authorId = author?.id || post.authorId;
      post = await this.postRepository.save(post);
      this.logger.log('Updated demo blog post');
    }

    await this.ensureTranslation({
      lang,
      entityName: 'BlogPost',
      entityId: post.id,
      key: 'title',
      content: 'Post de prueba: tipos de contenido',
    });

    await this.ensureTranslation({
      lang,
      entityName: 'BlogPost',
      entityId: post.id,
      key: 'excerpt',
      content:
        'Un artículo de prueba en español que incluye todos los tipos de contenido comunes del editor para validar diseño, tipografía y tabla de contenidos.',
    });

    await this.ensureTranslation({
      lang,
      entityName: 'BlogPost',
      entityId: post.id,
      key: 'content',
      content: this.buildContent(),
    });
  }

  private async ensureLang(code: string, name: string): Promise<LangEntity> {
    let lang = await this.langRepository.findOne({ where: { code } });
    if (!lang) {
      lang = this.langRepository.create({ code, name, isActive: true });
      lang = await this.langRepository.save(lang);
      this.logger.log(`Created language: ${code}`);
    }
    return lang;
  }

  private async ensureCategory(data: {
    id: string;
    slug: string;
    name: string;
  }): Promise<BlogCategoryEntity> {
    let category = await this.categoryRepository.findOne({
      where: { slug: data.slug },
    });
    if (!category) {
      category = this.categoryRepository.create({
        id: data.id,
        slug: data.slug,
        name: data.name,
      });
      category = await this.categoryRepository.save(category);
      this.logger.log(`Created category: ${data.slug}`);
    }
    return category;
  }

  private async ensureTags(
    tags: Array<{ id: string; slug: string; name: string }>,
  ): Promise<TagEntity[]> {
    const result: TagEntity[] = [];
    for (const t of tags) {
      let tag = await this.tagRepository.findOne({ where: { slug: t.slug } });
      if (!tag) {
        tag = this.tagRepository.create({
          id: t.id,
          slug: t.slug,
          name: t.name,
        });
        tag = await this.tagRepository.save(tag);
        this.logger.log(`Created tag: ${t.slug}`);
      }
      result.push(tag);
    }
    return result;
  }

  private async ensureTranslation(data: {
    lang: LangEntity;
    entityName: string;
    entityId: string;
    key: string;
    content: string;
  }): Promise<void> {
    const existing = await this.translationRepository.findOne({
      where: {
        lang: { id: data.lang.id },
        entityName: data.entityName,
        entityId: data.entityId,
        key: data.key,
      },
    });

    if (existing) {
      if (existing.content !== data.content) {
        existing.content = data.content;
        await this.translationRepository.save(existing);
        this.logger.log(`Updated translation: ${data.key}`);
      }
      return;
    }

    const translation = this.translationRepository.create({
      lang: data.lang,
      entityName: data.entityName,
      entityId: data.entityId,
      key: data.key,
      content: data.content,
      section: 'dynamic',
      app: 'cms',
    });
    await this.translationRepository.save(translation);
    this.logger.log(`Created translation: ${data.key}`);
  }

  private buildContent(): string {
    return `<h2>Introducción al post de prueba</h2>
<p>Este artículo sirve para validar que el diseño del blog, la tipografía y la <strong>tabla de contenidos</strong> funcionan correctamente. Incluye <em>énfasis</em>, <u>subrayado</u> y otros formatos habituales.</p>

<h2>Tipografía y formato</h2>
<p>El editor permite combinar múltiples estilos dentro de un mismo párrafo. Por ejemplo, podemos marcar un texto como <strong>importante</strong>, añadir <em>matices</em> o incluso <u>destacar una frase completa</u>.</p>

<h3>Estilos de texto</h3>
<p>Lista de estilos soportados de forma nativa:</p>
<ul>
  <li><strong>Negrita</strong> para puntos clave.</li>
  <li><em>Itálica</em> para matices o títulos de obras.</li>
  <li><u>Subrayado</u> para enlaces o advertencias visuales.</li>
  <li><code>inline code</code> para nombres de variables o comandos cortos.</li>
</ul>

<h3>Listas ordenadas</h3>
<p>Los pasos para publicar un artículo son:</p>
<ol>
  <li>Escribir el borrador en el panel de administración.</li>
  <li>Revisar SEO, categorías y etiquetas.</li>
  <li>Publicar y verificar la vista pública.</li>
</ol>

<h2>Bloques de código</h2>
<p>El formato de código es esencial en documentación técnica. A continuación un ejemplo en TypeScript:</p>
<pre><code class="language-typescript">function greet(name: string): string {
  return \`Hola, \${name}!\`;
}

console.log(greet('Foundation'));
</code></pre>

<h2>Citas y separadores</h2>
<p>Las citas ayudan a resaltar ideas de otros autores o frases inspiradoras.</p>
<blockquote>
  <p>"El software es una herramienta: los fundamentos sólidos importan más que el framework de moda."</p>
</blockquote>
<p>Los separadores horizontales permiten dividir secciones visualmente.</p>
<hr />

<h2>Enlaces e imágenes</h2>
<p>Los enlaces deben ser claros y accesibles. Ejemplo: <a href="https://example.com" target="_blank" rel="noopener noreferrer">enlace de ejemplo</a>.</p>
<p>Las imágenes deben incluir texto alternativo descriptivo:</p>
<figure>
  <img src="https://placehold.co/1200x600/1e1e1e/F97316?text=Foundation+CMS" alt="Placeholder naranja sobre fondo oscuro con el texto Foundation CMS" />
  <figcaption>Imagen de prueba con relación de aspecto 2:1.</figcaption>
</figure>

<h2>Tablas</h2>
<p>Las tablas organizan datos comparativos de forma legible:</p>
<table>
  <thead>
    <tr>
      <th>Característica</th>
      <th>Backend</th>
      <th>Frontend</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Framework</td>
      <td>NestJS</td>
      <td>Astro + Vue</td>
    </tr>
    <tr>
      <td>Estilos</td>
      <td>—</td>
      <td>Tailwind + DaisyUI</td>
    </tr>
    <tr>
      <td>Base de datos</td>
      <td>PostgreSQL + TypeORM</td>
      <td>—</td>
    </tr>
  </tbody>
</table>

<h2>Resumen</h2>
<p>Este post incluye títulos, párrafos, formatos de texto, listas ordenadas y desordenadas, bloques de código, código en línea, citas, separadores, enlaces, imágenes y tablas. Si todos estos elementos se renderizan correctamente, el sistema de contenido está listo para producción.</p>`;
  }
}
