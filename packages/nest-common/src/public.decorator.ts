import { SetMetadata } from "@nestjs/common";

/** Metadata key read by the JWT guard in @campus/auth. */
export const PUBLIC_ROUTE_KEY = "campus:public";

/** Marks a handler or controller as reachable without a token (login, health, version). */
export const Public = () => SetMetadata(PUBLIC_ROUTE_KEY, true);
