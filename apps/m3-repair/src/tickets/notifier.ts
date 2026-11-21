import { Global, Injectable, Logger, Module } from "@nestjs/common";

/** Injection token for the out-of-module notification port. */
export const NOTIFIER = Symbol("NOTIFIER");

export type SlaNotificationKind = "SLA_ESCALATED" | "SLA_REWORK_REMINDER";

/**
 * The payload a D-3 notification adapter will consume once TASK-042 exists. It carries no
 * module-specific logic: the escalation service decides when, not how, a message is delivered.
 */
export interface SlaNotification {
  ticketId: string;
  kind: SlaNotificationKind;
  recipientIds: string[];
  occurredAt: string;
}

export interface Notifier {
  notify(input: SlaNotification): Promise<void>;
}

/** Placeholder until D-3 ships: records delivery intent without contacting a user. */
@Injectable()
export class LoggingNotifier implements Notifier {
  private readonly logger = new Logger(LoggingNotifier.name);

  async notify(input: SlaNotification): Promise<void> {
    this.logger.log(
      `${input.kind} ticket=${input.ticketId} recipients=${input.recipientIds.join(",")} at=${input.occurredAt}`,
    );
  }
}

@Global()
@Module({
  providers: [{ provide: NOTIFIER, useClass: LoggingNotifier }],
  exports: [NOTIFIER],
})
export class NotifierModule {}
