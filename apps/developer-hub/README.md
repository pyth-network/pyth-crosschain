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
4. Make your edits to the relevant `.mdx` files
5. Preview your changes locally using the dev server
6. Run linting/formatting checks:

   ```bash
   pnpm turbo run fix:format
   pnpm turbo run fix:lint:eslint
   ```

7. Commit and push your changes to your fork
8. Submit a pull request from your fork with a clear description of your changes

### Content Best Practices

- Write clear, concise documentation
- Use proper heading hierarchy (h2, h3, etc.)
- Link to related documentation when relevant

## Available Commands

- `pnpm turbo run start:dev` - Start development server
- `pnpm turbo run build` - Build the project
- `pnpm turbo run fix:format` - Format code with Prettier
- `pnpm turbo run fix:lint:eslint` - Fix ESLint issues
- `pnpm turbo run test:format` - Check formatting
- `pnpm turbo run test:lint:eslint` - Check for linting errors
- `pnpm turbo run test:types` - Check TypeScript types

## Getting Help

- Open an issue on GitHub for questions or problems
- Check existing documentation for examples
- Review similar pages in the `content/docs/` directory for reference
