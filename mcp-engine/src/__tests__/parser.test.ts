import { describe, it, expect } from "vitest";
import { parseTypeScript, parseMarkdown } from "../parser";

describe("parseTypeScript", () => {
  it("should extract imports with named imports", () => {
    const code = `
      import { UserService } from '@users/user.service';
      import { ConfigService } from '@nestjs/config';
    `;
    const result = parseTypeScript(code, "test.ts");

    expect(result.imports).toContain("@users/user.service");
    expect(result.imports).toContain("@nestjs/config");
  });

  it("should extract imports with default imports", () => {
    const code = `
      import fs from 'fs';
      import express from 'express';
    `;
    const result = parseTypeScript(code, "test.ts");

    expect(result.imports).toContain("fs");
    expect(result.imports).toContain("express");
  });

  it("should extract imports with namespace imports", () => {
    const code = `
      import * as utils from './utils';
    `;
    const result = parseTypeScript(code, "test.ts");

    expect(result.imports).toContain("./utils");
  });

  it("should detect NestJS framework from @Injectable", () => {
    const code = `
      @Injectable()
      export class MyService {}
    `;
    const result = parseTypeScript(code, "test.ts");
    expect(result.framework).toBe("nestjs");
  });

  it("should detect NestJS framework from @Module", () => {
    const code = `
      @Module({
        providers: [MyService],
      })
      export class AppModule {}
    `;
    const result = parseTypeScript(code, "test.ts");
    expect(result.framework).toBe("nestjs");
  });

  it("should detect Vue framework from defineComponent", () => {
    const code = `
      export default defineComponent({
        name: 'MyComponent',
      });
    `;
    const result = parseTypeScript(code, "test.ts");
    expect(result.framework).toBe("vue");
  });

  it("should detect Vue framework from @Component", () => {
    const code = `
      @Component({
        name: 'MyComponent',
      })
      export class MyComponent {}
    `;
    const result = parseTypeScript(code, "test.ts");
    expect(result.framework).toBe("vue");
  });

  it("should detect .vue files as vue framework", () => {
    const code = `
      export class MyComponent {}
    `;
    const result = parseTypeScript(code, "MyComponent.vue");
    expect(result.framework).toBe("vue");
  });

  it("should extract named exports", () => {
    const code = `
      export class UserService {}
      export interface UserDto {}
      export type UserResponse = {};
      export function helper() {}
      export const CONSTANT = 1;
    `;
    const result = parseTypeScript(code, "test.ts");

    expect(result.exports).toContain("UserService");
    expect(result.exports).toContain("UserDto");
    expect(result.exports).toContain("UserResponse");
    expect(result.exports).toContain("helper");
    expect(result.exports).toContain("CONSTANT");
  });

  it("should extract abstract classes", () => {
    const code = `
      export abstract class BaseService {
        abstract findAll(): void;
      }
    `;
    const result = parseTypeScript(code, "test.ts");

    expect(result.exports).toContain("BaseService");
  });

  it("should extract leading doc comments", () => {
    const code = `
      /**
       * This is a service for managing users
       * @since 1.0.0
       */
      export class UserService {}
    `;
    const result = parseTypeScript(code, "test.ts");

    expect(result.docComment).toBeTruthy();
    expect(result.docComment).toContain("This is a service for managing users");
    expect(result.docComment).toContain("@since");
  });

  it("should return null for doc comment when none exists", () => {
    const code = `
      export class UserService {}
    `;
    const result = parseTypeScript(code, "test.ts");

    expect(result.docComment).toBeNull();
  });

  it("should detect typescript language", () => {
    const result = parseTypeScript("export class Test {}", "test.ts");
    expect(result.language).toBe("typescript");
  });

  it("should detect javascript language", () => {
    const result = parseTypeScript("export class Test {}", "test.js");
    expect(result.language).toBe("javascript");
  });

  it("should extract significant keywords", () => {
    const code = `
      export class AuthenticationService {
        async validateCredentials(username: string, password: string): Promise<boolean> {
          return true;
        }
      }
    `;
    const result = parseTypeScript(code, "test.ts");

    expect(result.keywords).toContain("AuthenticationService");
    expect(result.keywords).toContain("validateCredentials");
    expect(result.keywords).toContain("username");
    expect(result.keywords).toContain("password");
  });

  it("should filter out common programming stop words", () => {
    const code = `
      export function processData(data: any): any {
        const result = data.map((item: any) => item.value);
        return result;
      }
    `;
    const result = parseTypeScript(code, "test.ts");

    expect(result.keywords).not.toContain("function");
    expect(result.keywords).not.toContain("class");
    expect(result.keywords).not.toContain("export");
    expect(result.keywords).not.toContain("return");
  });
});

describe("parseMarkdown", () => {
  it("should detect language as markdown", () => {
    const result = parseMarkdown("# Hello", "test.md");
    expect(result.language).toBe("markdown");
  });

  it("should extract frontmatter title", () => {
    const content = `---
title: API Documentation
description: API reference
---

# API Docs
`;
    const result = parseMarkdown(content, "test.md");

    expect(result.docComment).toBe("API Documentation");
  });

  it("should extract first heading when no frontmatter", () => {
    const content = `# Getting Started

This is the introduction.
`;
    const result = parseMarkdown(content, "test.md");

    expect(result.docComment).toBe("Getting Started");
  });

  it("should detect nestjs framework from content", () => {
    const content = `# NestJS Guide

Documentation for NestJS framework.
`;
    const result = parseMarkdown(content, "test.md");

    expect(result.framework).toBe("nestjs");
  });

  it("should extract keywords from headings", () => {
    const content = `# Introduction to Authentication
# JWT Token Management
# User Permissions

Some content here.
`;
    const result = parseMarkdown(content, "test.md");

    expect(result.keywords).toContain("Introduction");
    expect(result.keywords).toContain("Authentication");
    expect(result.keywords).toContain("Management");
  });

  it("should return empty imports and exports", () => {
    const result = parseMarkdown("# Hello", "test.md");

    expect(result.imports).toEqual([]);
    expect(result.exports).toEqual([]);
  });
});
