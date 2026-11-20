import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Permanent Android identity. Changing this creates a different app.
  appId: "com.muhib.colorwars",
  appName: "Color Wars",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#0f1115",
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // The app reveals the splash it hides after the first screen is ready.
      launchAutoHide: false,
      launchFadeOutDuration: 500,
      backgroundColor: "#0f1115",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
  },
};

export default config;
