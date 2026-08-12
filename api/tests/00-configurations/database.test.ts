import 'mocha';
import 'should';
import {initDb} from '../mocks/app';

describe('Database - connect', () => {
  before(function() {
    this.timeout(30000);
    return initDb();
  });

  it('should connect database', () => {
    true.should.be.equal(true);
  });
});