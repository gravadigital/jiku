import 'mocha';
import 'should';
import { QueryTypes } from 'sequelize';
import { initDb } from '../mocks/app';
import { sequelize } from '../../lib/models';
import { allModels, IdentityType, User } from '@jiku/models';

/**
 * S-015: `User` gana `roles` (JSONB) e `identityType` (STRING) — el contrato del modelo.
 *
 * Conviene ser explícito sobre qué prueba y qué no.
 *
 * LO QUE PRUEBA: lo que `sequelize.sync()` produce. Los defaults en la instancia y en la base,
 * el nombre físico `identity_type` que sale de `underscored: true`, la nulabilidad, que los
 * `DEFAULT` estén en la base (y no solo en la clase), que nada valide `roles` contra un
 * catálogo, y — el escenario más valioso del archivo — que un `INSERT` crudo que NO menciona
 * las dos columnas siga funcionando: es el mecanismo exacto por el que los 127 puntos de
 * siembra de `User` que ya existen en `api/tests/` y `core/tests/` pasan sin una línea de
 * cambio (CA-13).
 *
 * LO QUE NO PRUEBA: el ENUM nativo. El esquema de esta suite lo construye `sequelize.sync()`,
 * no las migraciones (ADR-013, su límite declarado), así que acá `identity_type` es un
 * `VARCHAR(255)` sin CHECK. La verificación de que la migración crea el tipo nativo
 * `identity_type` con sus dos valores es del plan de `api`, contra una base migrada. Por la
 * misma razón NO hay ningún escenario que afirme que un `identityType` inválido es rechazado:
 * contra `sync()` ese `INSERT` pasa, y el test fallaría por el límite de ADR-013 y no por un
 * bug del producto. La validación del valor vive en el consumidor del evento (S-016).
 *
 * El valor real del archivo es TS-11: fijar como contrato que NO existe ningún tipo enum
 * `%identity%`. Esa aserción es la que rompe el día que alguien "arregle" el modelo a
 * `DataType.ENUM` — que es lo que crearía `enum_users_identity_type`, distinto del
 * `identity_type` de la migración, convirtiendo una divergencia conocida y precedentada en una
 * desconocida. Es la única red automatizada contra el modo de falla que da forma a la story.
 */

const SEEDED_IDS = ['u-idt-01', 'u-idt-02', 'u-idt-03', 'u-idt-04', 'u-idt-05'];

describe('S-015 - User gana roles e identityType', () => {
  before(function () {
    this.timeout(30000);
    return initDb();
  });

  // Ids con prefijo propio para no colisionar con otros archivos: ADR-013 pide que ninguno
  // dependa del orden de ejecución.
  after(() => {
    return User.destroy({ where: { id: SEEDED_IDS } });
  });

  describe('defaults del modelo y de la base', () => {
    // TS-1
    it('TS-1: el default de roles es lista vacía, en la instancia y en la base', () => {
      return User.create({
        id: 'u-idt-01',
        name: 'Ana',
        username: 'ana',
        email: 'ana@mail.com',
      })
        .then((created) => {
          created.roles.should.be.eql([]);
          return User.findByPk('u-idt-01');
        })
        .then((found) => {
          (found !== null).should.be.true();
          (found as User).roles.should.be.eql([]);
          return sequelize.query<{ roles: string[] }>(
            "SELECT roles FROM users WHERE id = 'u-idt-01'",
            { type: QueryTypes.SELECT }
          );
        })
        .then((rows) => {
          rows.should.have.length(1);
          rows[0].roles.should.be.eql([]);
        });
    });

    // TS-2
    it('TS-2: el default de identityType es person, en la instancia y en la base', () => {
      return User.create({
        id: 'u-idt-02',
        name: 'Beto',
        username: 'beto',
        email: 'beto@mail.com',
      })
        .then((created) => {
          created.identityType.should.be.equal('person');
          return User.findByPk('u-idt-02');
        })
        .then((found) => {
          (found !== null).should.be.true();
          (found as User).identityType.should.be.equal('person');
          return sequelize.query<{ identity_type: string }>(
            "SELECT identity_type FROM users WHERE id = 'u-idt-02'",
            { type: QueryTypes.SELECT }
          );
        })
        .then((rows) => {
          rows.should.have.length(1);
          rows[0].identity_type.should.be.equal('person');
        });
    });

    // TS-9
    it('TS-9: identityType service se acepta y persiste', () => {
      return User.create({
        id: 'u-idt-04',
        name: 'Bot',
        username: 'bot',
        email: 'bot@mail.com',
        identityType: IdentityType.Service,
      })
        .then(() => User.findByPk('u-idt-04'))
        .then((found) => {
          (found !== null).should.be.true();
          (found as User).identityType.should.be.equal('service');
          return sequelize.query<{ identity_type: string }>(
            "SELECT identity_type FROM users WHERE id = 'u-idt-04'",
            { type: QueryTypes.SELECT }
          );
        })
        .then((rows) => {
          rows.should.have.length(1);
          rows[0].identity_type.should.be.equal('service');
        });
    });
  });

  describe('roles no se valida contra ningún catálogo (CA-10)', () => {
    // TS-7
    it('TS-7: roles acepta cualquier array de strings y conserva el orden', () => {
      const roles = ['user', 'admin', 'rol-que-no-existe-en-ningun-catalogo'];
      return User.create({
        id: 'u-idt-03',
        name: 'Cira',
        username: 'cira',
        email: 'cira@mail.com',
        roles,
      })
        .then(() => User.findByPk('u-idt-03'))
        .then((found) => {
          (found !== null).should.be.true();
          (found as User).roles.should.be.eql(roles);
        });
    });

    // TS-8
    it('TS-8: no hay ningún CHECK sobre roles ni sobre identity_type', () => {
      return sequelize
        .query<{ conname: string; def: string }>(
          `SELECT conname, pg_get_constraintdef(oid) AS def
             FROM pg_constraint
            WHERE conrelid = 'users'::regclass AND contype = 'c'`,
          { type: QueryTypes.SELECT }
        )
        .then((rows) => {
          const mentioning = rows.filter((row) => {
            return row.def.includes('roles') || row.def.includes('identity_type');
          });
          mentioning.should.have.length(0);
        });
    });
  });

  describe('el esquema que deja sync() (catálogo de PostgreSQL)', () => {
    /**
     * TS-3. Asertar que `identity_type` está es la mitad fácil. La mitad que atrapa el error
     * real es que NO estén `identityType` ni `identitytype`: es lo que aparecería si alguien
     * quitara `underscored: true` o declarara un `field` a mano.
     */
    it('TS-3: la columna física se llama identity_type, no identityType', () => {
      return sequelize
        .query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`,
          { type: QueryTypes.SELECT }
        )
        .then((rows) => {
          const names = rows.map((row) => row.column_name);
          names.should.containEql('roles');
          names.should.containEql('identity_type');
          names.should.not.containEql('identityType');
          names.should.not.containEql('identitytype');
        });
    });

    // TS-4
    it('TS-4: las dos columnas son NOT NULL en la base', () => {
      return sequelize
        .query<{ column_name: string; is_nullable: string }>(
          `SELECT column_name, is_nullable FROM information_schema.columns
            WHERE table_name = 'users' AND column_name IN ('roles', 'identity_type')`,
          { type: QueryTypes.SELECT }
        )
        .then((rows) => {
          rows.should.have.length(2);
          rows.forEach((row) => {
            row.is_nullable.should.be.equal('NO');
          });
        });
    });

    /**
     * TS-5. Los defaults son la garantía de CA-5: un `INSERT` que no menciona las columnas no
     * falla. Si alguien agregara un `ALTER COLUMN ... DROP DEFAULT`, esto es lo que lo delata.
     */
    it('TS-5: las dos columnas conservan su DEFAULT en la base', () => {
      return sequelize
        .query<{ column_name: string; column_default: string | null }>(
          `SELECT column_name, column_default FROM information_schema.columns
            WHERE table_name = 'users' AND column_name IN ('roles', 'identity_type')`,
          { type: QueryTypes.SELECT }
        )
        .then((rows) => {
          rows.should.have.length(2);
          rows.forEach((row) => {
            (row.column_default === null).should.be.false();
          });
          const byName = new Map(rows.map((row) => [row.column_name, row.column_default]));
          (byName.get('roles') as string).should.containEql('[]');
          (byName.get('identity_type') as string).should.containEql('person');
        });
    });

    /**
     * TS-11. La ausencia que es un contrato. El modelo declara `DataType.STRING` a propósito
     * para que `sync()` NO cree ningún tipo: si creara uno, se llamaría
     * `enum_users_identity_type` y sería distinto del `identity_type` que crea la migración.
     * Esta aserción es la que rompe si alguien cambia el modelo a `DataType.ENUM`.
     */
    it('TS-11: sync() no crea enum_users_identity_type: el modelo es STRING a propósito', () => {
      return sequelize
        .query<{ typname: string }>(
          `SELECT typname FROM pg_type WHERE typname LIKE '%identity%'`,
          { type: QueryTypes.SELECT }
        )
        .then((rows) => {
          rows.should.have.length(0);
        });
    });
  });

  describe('el mapeo declarado en el modelo', () => {
    // TS-6
    it('TS-6: roles es JSONB, not null, con default lista vacía', () => {
      const roles = User.getAttributes().roles;
      (roles.type as { key: string }).key.should.be.equal('JSONB');
      (roles.field as string).should.be.equal('roles');
      (roles.allowNull as boolean).should.be.false();
      (roles.defaultValue as string[]).should.be.eql([]);
    });

    /**
     * TS-6, segunda mitad. `type.key === 'STRING'` es la forma POSITIVA de decir "no es un
     * ENUM": un `DataType.ENUM` daría `key === 'ENUM'` y esto fallaría.
     */
    it('TS-6: identityType es STRING VARCHAR(255), not null, con default person', () => {
      const identityType = User.getAttributes().identityType;
      (identityType.type as { key: string }).key.should.be.equal('STRING');
      String(identityType.type).should.be.equal('VARCHAR(255)');
      (identityType.field as string).should.be.equal('identity_type');
      (identityType.allowNull as boolean).should.be.false();
      (identityType.defaultValue as string).should.be.equal('person');
    });
  });

  describe('el mecanismo de CA-13: los INSERT de cuatro campos siguen funcionando', () => {
    /**
     * TS-10. Va con SQL crudo y no con `User.create({...})` a propósito: `create` pasa por el
     * modelo, que ya conoce los defaults. El `INSERT` crudo prueba que el DEFAULT está en LA
     * BASE. `created_at` / `updated_at` se nombran porque el modelo tiene `timestamps: true` y
     * en el esquema de `sync()` son NOT NULL sin default.
     *
     * Si este escenario falla, CA-13 es falso y hay ~71 archivos de test por tocar.
     */
    it('TS-10: un INSERT crudo que no menciona las columnas toma los defaults', () => {
      return sequelize
        .query(
          `INSERT INTO users (id, name, username, email, created_at, updated_at)
           VALUES ('u-idt-05', 'Dora', 'dora', 'dora@mail.com', NOW(), NOW())`
        )
        .then(() => {
          return sequelize.query<{ roles: string[]; identity_type: string }>(
            "SELECT roles, identity_type FROM users WHERE id = 'u-idt-05'",
            { type: QueryTypes.SELECT }
          );
        })
        .then((rows) => {
          rows.should.have.length(1);
          rows[0].roles.should.be.eql([]);
          rows[0].identity_type.should.be.equal('person');
        });
    });
  });

  describe('barrel de @jiku/models', () => {
    /**
     * TS-12. Se asserta el array completo y no solo el `length`: es lo que hace que agregar un
     * tercer valor sin querer falle acá. En un enum de string de TypeScript no hay mapeo
     * inverso, así que `Object.keys` es el orden de declaración y es estable.
     */
    it('TS-12: el barrel exporta IdentityType con exactamente dos miembros', () => {
      Object.keys(IdentityType).should.be.eql(['Person', 'Service']);
      Object.values(IdentityType).should.be.eql(['person', 'service']);
    });

    // TS-13
    it('TS-13: la story no agrega modelos: allModels sigue en 26', () => {
      allModels.length.should.be.equal(26);
    });
  });
});
