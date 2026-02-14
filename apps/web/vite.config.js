import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), "");
    var target = env.API_PROXY_TARGET || "http://localhost:8080";
    return {
        plugins: [react()],
        server: {
            host: "0.0.0.0",
            port: 5173,
            strictPort: true,
            proxy: {
                "/api": {
                    target: target,
                    changeOrigin: true,
                    rewrite: function (p) { return p.replace(/^\/api/, ""); },
                },
            },
        },
        preview: {
            host: "0.0.0.0",
            port: 5173,
            strictPort: true,
            proxy: {
                "/api": {
                    target: target,
                    changeOrigin: true,
                    rewrite: function (p) { return p.replace(/^\/api/, ""); },
                },
            },
        },
    };
});
