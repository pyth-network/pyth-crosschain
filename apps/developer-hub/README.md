# Pyth Developer Hub

Welcome to the Pyth Developer Hub repository! This repository contains the documentation for Pyth Network's developer resources, including guides, tutorials, and API references.

## Getting Started

### Prerequisites

- Node.js >= 22.14.0
- pnpm

### Setup

1. Clone the monorepo repository

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Navigate to the developer hub directory:

   ```bash
   cd apps/developer-hub
   ```

4. Build the project:

   ```bash
   pnpm turbo run build
   ```

5. Start the development server:

   ```bash
   pnpm turbo run start:dev
   ```

6. Open [http://localhost:3627](http://localhost:3627) in your browser

## Project Structure

Documentation content lives in the `content/docs/` directory:

```text
content/docs/
├── price-feeds/     # Price feeds documentation
├── entropy/         # Entropy (RNG) documentation
├── express-relay/   # Express Relay documentation
└── ...
```

Each section can have:

- `index.mdx` - Main page for the section
- `meta.json` - Navigation structure and metadata
- Additional `.mdx` files for individual pages

## Content Writing Guidelines

### MDX Files

All documentation is written in MDX (Markdown + JSX). Each file starts with frontmatter:

```mdx
---
title: Page Title
description: Brief description for SEO and previews
icon: IconName # Optional, from @phosphor-icons/react
full: false # Optional, full-width layout
---
```

### Images

Place images in `public/images/` and reference them:

```mdx
![Alt text](/images/filename.png)
```

### Navigation

Update the `meta.json` file in each section to control navigation. Example:

```json
{
  "root": true,
  "title": "Section Title",
  "pages": ["index", "page-1", "page-2"]
}
```

## Contributing

1. Fork the `pyth-crosschain` repository
2. Clone your fork and navigate to the developer hub directory:

   ```bash
   cd apps/developer-hub
   ```

3. Create a new branch for your changes
4. Review the contributor guide in [AGENTS.md](./AGENTS.md) for project structure, coding standards, and security notes
5. Make your edits to the relevant `.mdx` files
6. Preview your changes locally using the dev server
7. Run linting/formatting checks:

   ```bash
   pnpm turbo run fix:format
   pnpm turbo run fix:lint:eslint
   ```

8. Commit and push your changes to your fork
9. Submit a pull request from your fork with a clear description of your changes

### Content Best Practices

- Write clear, concise documentation
- Use proper heading hierarchy (h2, h3, etc.)
- Link to related documentation when relevant

## API Reference Generation

The API reference documentation is automatically generated from OpenAPI specifications using the `scripts/generate-docs.ts` script. This script converts OpenAPI specs (from services like Hermes and Fortuna) into MDX documentation files.

### What It Does

The script performs the following steps:

1. **File Generation**: Uses `fumadocs-openapi` to convert OpenAPI specs into MDX files

   - Each API endpoint becomes a separate MDX file
   - Files are organized by product (e.g., `pyth-core`, `entropy`) and service (e.g., `hermes`, `fortuna`)

2. **Meta File Generation**: Creates `meta.json` files for navigation

   - Root `meta.json` for the API reference section
   - Product-level `meta.json` files (e.g., `pyth-core/meta.json`)
   - Service-level `meta.json` files (e.g., `pyth-core/hermes/meta.json`)

3. **Post-Processing**: Customizes generated files to match our documentation structure
   - Updates MDX frontmatter titles to use endpoint paths instead of operation IDs
   - Rewrites `index.mdx` files to use `APICard` components with proper formatting

### When to Run

The script runs automatically during the build process (`pnpm turbo run build`). You typically don't need to run it manually unless:

- You've updated an OpenAPI specification URL
- You've added a new service to the configuration
- You want to regenerate docs without doing a full build

### Manual Execution

To run the script manually:

```bash
pnpm generate:docs
```

This will:

- Fetch OpenAPI specs from the configured URLs
- Generate MDX files in `content/docs/api-reference/`
- Create/update all `meta.json` navigation files
- Post-process files to customize titles and index pages

### Configuration

To add a new API service, edit `src/lib/openapi.ts` and add an entry to the `products` object:

```typescript
export const products = {
  // ... existing services ...
  newService: {
    name: "newService",
    product: "product-category", // e.g., "pyth-core" or "entropy"
    openApiUrl: "https://api.example.com/docs/openapi.json",
  },
};
```

After adding a new service:

1. Run `pnpm generate:docs` to generate the documentation
2. The new service will appear in the API reference navigation

### Generated Files

All generated files are written to `content/docs/api-reference/`:

```
content/docs/api-reference/
├── meta.json                    # Root navigation
├── pyth-core/
│   ├── meta.json               # Product navigation
│   └── hermes/
│       ├── meta.json           # Service navigation
│       ├── index.mdx           # Service overview page
│       └── *.mdx               # Individual endpoint pages
└── entropy/
    └── ...
```

**Important**: Generated files should not be edited manually. Any changes will be overwritten the next time the script runs. If you need to customize the documentation, modify the OpenAPI specification or the generation script itself.

## Available Commands

- `pnpm turbo run start:dev` - Start development server
- `pnpm turbo run build` - Build the project (includes API reference generation)
- `pnpm generate:docs` - Generate API reference documentation manually
- `pnpm turbo run fix:format` - Format code with Prettier
- `pnpm turbo run fix:lint:eslint` - Fix ESLint issues
- `pnpm turbo run test:format` - Check formatting
- `pnpm turbo run test:lint:eslint` - Check for linting errors
- `pnpm turbo run test:types` - Check TypeScript types

## Getting Help

- Open an issue on GitHub for questions or problems
- Check existing documentation for examples
- Review similar pages in the `content/docs/` directory for reference
