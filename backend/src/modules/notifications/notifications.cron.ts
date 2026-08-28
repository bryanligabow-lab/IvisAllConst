import cron from 'node-cron';
import { NotificationsService } from './notifications.service';
import { ChequesNotifications } from '../cheques/cheques.notifications';
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

  startChequesCron();
}

/**
 * Avisos de cheques:
 *   - lunes 7:00 → resumen de los cheques por cubrir esta semana
 *   - todos los días 7:00 → aviso de los que se cubren MAÑANA y de los de HOY
 * Si un día no hay cheques, ese aviso no se manda (no se genera ruido).
 */
function startChequesCron(): void {
  const diario = process.env.CHEQUES_CRON || '0 7 * * *';
  const semanal = process.env.CHEQUES_WEEKLY_CRON || '0 7 * * 1';
  const mensual = process.env.CHEQUES_MONTHLY_CRON || '0 7 1 * *';
  if (!cron.validate(diario) || !cron.validate(semanal) || !cron.validate(mensual)) {
    logger.error('CHEQUES_CRON inválido, no se programan los avisos de cheques', {
      diario,
      semanal,
    });
    return;
  }

  cron.schedule(
    semanal,
    () => {
      void (async () => {
        if (!isMailConfigured()) return;
        try {
          logger.info('Aviso semanal de cheques', await ChequesNotifications.enviar('SEMANA'));
        } catch (err) {
          logger.error('Error en el aviso semanal de cheques', { error: (err as Error).message });
        }
      })();
    },
    { timezone: 'America/Guayaquil' },
  );

  // Mensual: solo para los financiamientos que lo tengan activado.
  cron.schedule(
    mensual,
    () => {
      void (async () => {
        if (!isMailConfigured()) return;
        try {
          logger.info('Aviso mensual de cheques', await ChequesNotifications.enviar('MES'));
        } catch (err) {
          logger.error('Error en el aviso mensual de cheques', { error: (err as Error).message });
        }
      })();
    },
    { timezone: 'America/Guayaquil' },
  );

  cron.schedule(
    diario,
    () => {
      void (async () => {
        if (!isMailConfigured()) return;
        try {
          logger.info('Aviso de cheques de mañana', await ChequesNotifications.enviar('MANANA'));
          logger.info('Aviso de cheques de hoy', await ChequesNotifications.enviar('HOY'));
        } catch (err) {
          logger.error('Error en los avisos diarios de cheques', {
            error: (err as Error).message,
          });
        }
      })();
    },
    { timezone: 'America/Guayaquil' },
  );

  logger.info('Cron de cheques programado', { diario, semanal, mensual });
}
