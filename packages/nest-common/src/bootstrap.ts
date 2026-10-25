import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export interface BootstrapOptions {
  /** Root module of the service. */
  module: unknown;
  /** Short name: the global prefix becomes `api/<service>`. */
  service: string;
  port: number;
  /** Serve Swagger UI at `api/<service>/docs`. Defaults to true outside production. */
  swagger?: boolean;
}

/**
 * Standard startup for every service. Keeping it here means all five services expose
 * the same prefix scheme, CORS policy and shutdown behavior, which nginx and the deploy
 * scripts rely on.
 */
export async function bootstrapService(options: BootstrapOptions): Promise<void> {
  const app = await NestFactory.create(options.module as never, { bufferLogs: true });
  const prefix = `api/${options.service}`;
  app.setGlobalPrefix(prefix);
  app.enableCors({ origin: true, credentials: true });
  app.enableShutdownHooks();

  const swagger = options.swagger ?? process.env.NODE_ENV !== "production";
  if (swagger) {
    const config = new DocumentBuilder()
      .setTitle(`campus-space ${options.service}`)
      .setVersion(process.env.GIT_TAG ?? "dev")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${prefix}/docs`, app, document);
  }

  await app.listen(options.port);
  new Logger("bootstrap").log(`${options.service} listening on :${options.port}/${prefix}`);
}
