import 'mocha';
import 'should';
import { nextAttemptAt } from '../../src/notifications/dispatch/backoff';

describe('notifications/dispatch/backoff — TS-11', () => {
  it('TS-11 · el backoff es exponencial entre intentos', () => {
    const now = new Date('2026-01-01T00:00:00Z');

    const first = nextAttemptAt(0, now);
    const second = nextAttemptAt(1, now);
    const third = nextAttemptAt(2, now);

    const firstDelay = (first.getTime() - now.getTime()) / 1000;
    const secondDelay = (second.getTime() - now.getTime()) / 1000;
    const thirdDelay = (third.getTime() - now.getTime()) / 1000;

    firstDelay.should.equal(60);
    secondDelay.should.equal(120);
    thirdDelay.should.equal(240);
    (secondDelay > firstDelay).should.be.true();
    (thirdDelay > secondDelay).should.be.true();
  });

  it('el retardo nunca supera el tope superior', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const farFuture = nextAttemptAt(20, now);
    const delaySeconds = (farFuture.getTime() - now.getTime()) / 1000;
    delaySeconds.should.equal(24 * 60 * 60);
  });
});
