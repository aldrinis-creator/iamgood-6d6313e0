import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.futurewave.checkin',
  appName: 'Check-iN',
  webDir: 'dist',
  server: {
    url: 'https://c08453f9-a772-43a6-ab7c-53dcaa1d84f2.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
