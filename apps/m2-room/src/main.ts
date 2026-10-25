import "reflect-metadata";
import { bootstrapService } from "@campus/nest-common";
import { createAppModule, SERVICE_NAME } from "./app.module";

const port = Number(process.env.M2_PORT ?? 3012);

bootstrapService({ module: createAppModule(), service: SERVICE_NAME, port }).catch(
  (error: unknown) => {
    console.error("m2-room failed to start", error);
    process.exit(1);
  },
);
