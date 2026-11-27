import sinon from 'sinon';
import { RequirementSubscriptor } from '@jiku/models';

/**
 * Makes every `RequirementSubscriptor.findAll` return the rows of `userId` TWICE, the shape the
 * `sync()` schema allowed by inserting two equal rows.
 *
 * The schema the migrations build has `idx_requirement_subscriptors_unique
 * (requirement_id, user_id)`, so two rows for the same user can no longer be stored. The tests that
 * prove what happens when the subscriptor read yields a repeated `userId` (TS-11 of S-071, TS-68 of
 * S-064) keep that input this way: the query really runs against the database and only its result
 * is widened, so the code under test (`resolveRecipients()` and the rules after it) still runs whole.
 *
 * Returns the stub; the caller restores it (`stub.restore()` or `sinon.restore()`).
 */
export function duplicateSubscriptorRows(userId: string): sinon.SinonStub {
  const realFindAll = RequirementSubscriptor.findAll.bind(RequirementSubscriptor);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return sinon.stub(RequirementSubscriptor, 'findAll').callsFake(async (options?: any) => {
    const rows = (await realFindAll(options)) as RequirementSubscriptor[];
    return [...rows, ...rows.filter((row) => row.userId === userId)];
  });
}
