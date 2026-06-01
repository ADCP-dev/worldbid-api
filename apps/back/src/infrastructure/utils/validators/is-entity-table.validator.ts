import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@ValidatorConstraint({ name: 'IsEntityTable', async: true })
@Injectable()
export class IsEntityTableConstraint implements ValidatorConstraintInterface {
  constructor(private readonly dataSource: DataSource) {}

  async validate(value: string) {
    if (!value) return true;

    const entities = this.dataSource.entityMetadatas;
    return entities.some(
      (entity) =>
        entity.tableName === value ||
        entity.name === value ||
        entity.name.replace(/Entity$/, '') === value,
    );
  }

  defaultMessage(args: ValidationArguments) {
    return `Entity table "${args.value}" does not exist in the database.`;
  }
}

export function IsEntityTable(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsEntityTableConstraint,
    });
  };
}
