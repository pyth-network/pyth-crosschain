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
      'n/no-process-env': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
]
