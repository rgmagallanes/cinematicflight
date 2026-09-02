import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createMemoryBookingStore, handleBookingRequest } from "./worker/index.js";

function localBookingRelay(env) {
  const store = createMemoryBookingStore();
  return {
    name: "local-booking-relay",
    configureServer(server) {
      server.middlewares.use("/api/bookings", async (request, response) => {
        const body = [];
        for await (const chunk of request) body.push(chunk);
        const origin = `${request.socket.encrypted ? "https" : "http"}://${request.headers.host || "localhost"}`;
        const headers = new Headers();
        for (const [name, value] of Object.entries(request.headers)) {
          if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
          else if (value !== undefined) headers.set(name, value);
        }
        if (!headers.has("x-forwarded-for")) headers.set("x-forwarded-for", request.socket.remoteAddress || "local");

        const relayResponse = await handleBookingRequest(
          new Request(`${origin}/api/bookings`, {
            method: request.method,
            headers,
            body: Buffer.concat(body),
          }),
          env,
          { store },
        );

        response.statusCode = relayResponse.status;
        relayResponse.headers.forEach((value, name) => response.setHeader(name, value));
        response.end(Buffer.from(await relayResponse.arrayBuffer()));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    define: { __LOCAL_REVIEW_SERVER__: JSON.stringify(mode === "review") },
    build: {
      outDir: "dist/client",
    },
    optimizeDeps: {
      include: ["react", "react-dom/client"],
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(mode === "review" ? {
        host: "127.0.0.1", port: 5182, strictPort: true,
        proxy: { "/review-api": { target: "http://127.0.0.1:5183", rewrite: (path) => path.replace(/^\/review-api/, "/api") } },
      } : {}),
      warmup: {
        clientFiles: ["./src/main.jsx"],
      },
    },
    plugins: [react(), localBookingRelay(env)],
  };
});
