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
};

export default config;
