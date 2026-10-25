import "reflect-metadata";
import { bootstrapService } from "@campus/nest-common";
import { createAppModule, SERVICE_NAME } from "./app.module";

const port = Number(process.env.M1_PORT ?? 3011);

bootstrapService({ module: createAppModule(), service: SERVICE_NAME, port }).catch(
  (error: unknown) => {
    console.error("m1-seat failed to start", error);
    process.exit(1);
  },
);
