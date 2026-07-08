import cron from 'node-cron';
import { NotificationsService } from './notifications.service';
import { isMailConfigured } from '../../shared/email/mailer';
import { logger } from '../../utils/logger';

/**
 * Programa el informe diario de planillas + los recordatorios a residentes.
 * Corre todos los días a la hora de `REPORT_CRON` (default 7:00 en Ecuador).
 * Si no hay SMTP configurado, las funciones se saltan solas (no envían).
 */
export function startNotificationsCron(): void {
  const schedule = process.env.REPORT_CRON || '0 7 * * *';
  const reminderDays = Number(process.env.REMINDER_DAYS || 5);

  if (!cron.validate(schedule)) {
    logger.error('REPORT_CRON inválido, no se programa el informe', { schedule });
    return;
  }

  cron.schedule(
    schedule,
    () => {
      void (async () => {
        if (!isMailConfigured()) return; // aún sin correo emisor
        try {
          const report = await NotificationsService.sendDailyReport();
          logger.info('Informe diario de planillas', report);
          const reminders = await NotificationsService.sendStuckReminders(reminderDays);
          logger.info('Recordatorios de planillas', reminders);
        } catch (err) {
          logger.error('Error enviando informe/recordatorios', {
            error: (err as Error).message,
          });
        }
      })();
    },
    { timezone: 'America/Guayaquil' },
  );

  logger.info('Cron de planillas programado', {
    schedule,
    reminderDays,
    mail: isMailConfigured() ? 'configurado' : 'pendiente (sin SMTP)',
  });
}
