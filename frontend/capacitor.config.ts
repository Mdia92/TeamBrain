import type { CapacitorConfig } from "@capacitor/cli";

const devServerUrl = process.env.CAPACITOR_DEV_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.teambrain.app",
  appName: "TeamBrain",
  webDir: "out",
  server: devServerUrl
    ? {
        url: devServerUrl,
        cleartext: true,
      }
    : undefined,
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#4F46E5",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#4F46E5",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
