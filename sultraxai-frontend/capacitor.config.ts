import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sultraxai.app',
  appName: 'SultraxAI',
  webDir: 'dist',
  server: {
    // In production the app loads from bundled dist/
    // During dev you can point to your server for live reload:
    // url: 'http://38.180.137.122:8000',
    // cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#070707',
    preferredContentMode: 'mobile',
  },
};

export default config;
