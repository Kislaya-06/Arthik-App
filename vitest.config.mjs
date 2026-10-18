import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  define: {
    __DEV__: true,
  },
  resolve: {
    alias: {
      '@react-native-community/netinfo': path.resolve(import.meta.dirname, 'tests/mocks/netinfo.ts'),
      'expo-haptics': path.resolve(import.meta.dirname, 'tests/mocks/haptics.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
