import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const domainNames = [
  'admin',
  'auth',
  'dashboard',
  'fines',
  'leaderboard',
  'treasury',
];

const appImportRestriction = {
  regex: '^(?:@/app(?:/|$)|(?:\\.\\./)+app(?:/|$))',
  message: 'Esta camada não pode depender de src/app.',
};

const domainBoundaryConfigs = domainNames.map((domainName) => {
  const otherDomains = domainNames.filter(
    (candidate) => candidate !== domainName,
  );
  const otherDomainsPattern = otherDomains.join('|');

  return {
    files: [`src/domains/${domainName}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            appImportRestriction,
            {
              regex: `^(?:@/domains/|(?:\\.\\./)+)(?:${otherDomainsPattern})(?:/|$)`,
              message:
                'Um domínio não pode importar diretamente outro domínio.',
            },
          ],
        },
      ],
    },
  };
});

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      '.playwright-browsers',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            appImportRestriction,
            {
              regex: '^(?:@/domains(?:/|$)|(?:\\.\\./)+domains(?:/|$))',
              message: 'src/shared não pode depender de src/domains.',
            },
          ],
        },
      ],
    },
  },
  ...domainBoundaryConfigs,
  {
    files: ['*.config.{js,ts}'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
