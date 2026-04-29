import { validate } from 'class-validator';
import { CreateBlogCategoryDto } from './create-category.dto';

describe('CreateBlogCategoryDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = new CreateBlogCategoryDto();
    dto.name = 'Technology';
    dto.slug = 'technology';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation when name is empty', async () => {
    const dto = new CreateBlogCategoryDto();
    dto.name = '';

    const errors = await validate(dto);
    const nameErrors = errors.find((e) => e.property === 'name');
    expect(nameErrors).toBeDefined();
  });

  it('should fail validation when name exceeds max length', async () => {
    const dto = new CreateBlogCategoryDto();
    dto.name = 'a'.repeat(101);

    const errors = await validate(dto);
    const nameErrors = errors.find((e) => e.property === 'name');
    expect(nameErrors).toBeDefined();
  });

  it('should pass validation when optional fields are omitted', async () => {
    const dto = new CreateBlogCategoryDto();
    dto.name = 'Design';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
