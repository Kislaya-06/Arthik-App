import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  define: {
    __DEV__: true,
  },
  plugins: [
    {
      name: 'stub-lucide-native-icon',
      resolveId(id) {
        if (id.includes('createLucideIcon.mjs') || id.includes('Icon.mjs')) {
          return path.resolve(import.meta.dirname, 'tests/__stubs__/createLucideIcon.ts');
        }
      },
    },
  ],
  resolve: {
    alias: [
      { find: '@react-native-community/netinfo', replacement: path.resolve(import.meta.dirname, 'tests/mocks/netinfo.ts') },
      { find: 'expo-haptics', replacement: path.resolve(import.meta.dirname, 'tests/mocks/haptics.ts') },
      { find: 'react-native-svg', replacement: path.resolve(import.meta.dirname, 'tests/__stubs__/svg.ts') },
    ],
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    server: {
      deps: {
        inline: ['lucide-react-native'],
      },
    },
  },
});
