import 'mocha';
import 'should';
import { Op } from 'sequelize';
import { SystemSetting } from '@jiku/models';
import { sequelize } from '../../src/models';
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_INTERVAL_SECONDS,
  DEFAULT_MAX_ATTEMPTS,
  NOTIFICATION_SETTING_KEYS,
  readNotificationSettings,
} from '../../src/notifications/dispatch/settings';

describe('notifications/dispatch/settings — CA-5', () => {
  beforeEach(async () => {
    await SystemSetting.destroy({
      where: { key: { [Op.in]: Object.values(NOTIFICATION_SETTING_KEYS) } },
    });
  });

  it('clave ausente cae al default de código', async () => {
    const transaction = await sequelize.transaction();
    try {
      const settings = await readNotificationSettings(transaction);
      settings.intervalSeconds.should.equal(DEFAULT_INTERVAL_SECONDS);
      settings.batchSize.should.equal(DEFAULT_BATCH_SIZE);
      settings.maxAttempts.should.equal(DEFAULT_MAX_ATTEMPTS);
    } finally {
      await transaction.commit();
    }
  });

  it('valor no parseable cae al default, sin propagar el error', async () => {
    await SystemSetting.create({ key: NOTIFICATION_SETTING_KEYS.batchSize, value: 'abc' });

    const transaction = await sequelize.transaction();
    try {
      const settings = await readNotificationSettings(transaction);
      settings.batchSize.should.equal(DEFAULT_BATCH_SIZE);
    } finally {
      await transaction.commit();
    }
  });

  it('un valor de 0 o negativo cae al default', async () => {
    await SystemSetting.create({ key: NOTIFICATION_SETTING_KEYS.maxAttempts, value: '0' });

    const transaction = await sequelize.transaction();
    try {
      const settings = await readNotificationSettings(transaction);
      settings.maxAttempts.should.equal(DEFAULT_MAX_ATTEMPTS);
    } finally {
      await transaction.commit();
    }
  });

  it('un valor válido se respeta', async () => {
    await SystemSetting.create({ key: NOTIFICATION_SETTING_KEYS.batchSize, value: '7' });

    const transaction = await sequelize.transaction();
    try {
      const settings = await readNotificationSettings(transaction);
      settings.batchSize.should.equal(7);
    } finally {
      await transaction.commit();
    }
  });
});
