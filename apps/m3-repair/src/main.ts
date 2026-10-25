import "reflect-metadata";
import { bootstrapService } from "@campus/nest-common";
import { createAppModule, SERVICE_NAME } from "./app.module";

const port = Number(process.env.M3_PORT ?? 3013);

bootstrapService({ module: createAppModule(), service: SERVICE_NAME, port }).catch(
  (error: unknown) => {
    console.error("m3-repair failed to start", error);
    process.exit(1);
  },
);
