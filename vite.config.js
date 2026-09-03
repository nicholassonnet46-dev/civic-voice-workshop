import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: "node",
    include: ["server/**/*.test.js", "facilitator/**/*.test.js", "client/**/*.test.js"],
  },
});
