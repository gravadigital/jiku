'use strict';

// Seed idempotente del usuario de sistema `mail-bot` (REQ-039 / S-062).
// El repo no tiene mecanismo de seeders separado, por lo que se implementa como migración.
// `ON CONFLICT (id) DO NOTHING` garantiza idempotencia: re-ejecutar no duplica ni falla.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      INSERT INTO users (id, name, username, email, created_at, updated_at)
      VALUES ('system-mail-bot', 'Mail Bot', 'mail-bot', 'mail-bot@example.invalid', now(), now())
      ON CONFLICT (id) DO NOTHING;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DELETE FROM users WHERE id = 'system-mail-bot';
    `);
  },
};
