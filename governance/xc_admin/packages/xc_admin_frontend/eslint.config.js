import { fileURLToPath } from 'node:url'

import { nextjs, tailwind, storybook } from '@cprussin/eslint-config'

const tailwindConfig = fileURLToPath(
  import.meta.resolve(`./tailwind.config.js`)
)

export default [
  ...nextjs,
  ...tailwind(tailwindConfig),
  ...storybook,
  {
    rules: {
      'unicorn/filename-case': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
    },
  },
]
