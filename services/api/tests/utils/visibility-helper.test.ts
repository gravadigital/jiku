import 'mocha';
import 'should';
import {
  getVisibilityForActivityType,
  isVisibilityConfigurable,
  ActivityType
} from '../../lib/utils/visibility-helper';
import { activityVisibilityLevel } from '@jiku/models';

describe('Utils visibility-helper', () => {
  describe('getVisibilityForActivityType', () => {
    const publicTypes: ActivityType[] = ['state', 'title', 'description'];
    const internalTypes: ActivityType[] = ['area', 'person', 'priority', 'estimatedFinishDate', 'stageId', 'comment'];

    publicTypes.forEach((type) => {
      it(`should return "public" for ${type}`, () => {
        const result = getVisibilityForActivityType(type);
        result.should.be.equal(activityVisibilityLevel.Public);
      });
    });

    internalTypes.forEach((type) => {
      it(`should return "internal" for ${type}`, () => {
        const result = getVisibilityForActivityType(type);
        result.should.be.equal(activityVisibilityLevel.Internal);
      });
    });
  });

  describe('isVisibilityConfigurable', () => {
    it('should return true for comment', () => {
      const result = isVisibilityConfigurable('comment');
      result.should.be.true();
    });

    it('should return false for state', () => {
      const result = isVisibilityConfigurable('state');
      result.should.be.false();
    });

    it('should return false for area', () => {
      const result = isVisibilityConfigurable('area');
      result.should.be.false();
    });

    it('should return false for title', () => {
      const result = isVisibilityConfigurable('title');
      result.should.be.false();
    });

    it('should return false for description', () => {
      const result = isVisibilityConfigurable('description');
      result.should.be.false();
    });

    it('should return false for priority', () => {
      const result = isVisibilityConfigurable('priority');
      result.should.be.false();
    });
  });
});
