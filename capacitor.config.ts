import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ru.actionquality.app",
  appName: "Action & Quality",
  webDir: "dist",
  backgroundColor: "#F9D7E8",
  ios: {
    contentInset: "always",
  },
};

export default config;
