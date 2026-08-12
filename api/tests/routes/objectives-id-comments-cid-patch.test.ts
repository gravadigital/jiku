import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Objective, ObjectiveActivity, Project, User } from '@jiku/models';

describe('PATCH /api/objectives/:id/comment/:cid', () => {
  let application : Application;

  before(function() {
    application = start();
    return Promise.all([
      User.create({
        id: 'zitadel-sub-01',
        name: 'User 01',
        username: 'user01',
        email: 'user01@mail.com'
      }),
      User.create({
        id: 'zitadel-sub-02',
        name: 'User 02',
        username: 'user02',
        email: 'user02@mail.com'
      }),
    ])
      .then(() => {
        return Project.create({
          id: 1,
          code: 'code1',
          name: 'Project1',
          type: 'comercial',
          description: 'Project test 1',
          status: 'activo',
          priority: 1,
          originId: 1,
          initDate: new Date(),
          createdBy: 'zitadel-sub-01'
        });
      })
      .then(() => {
        return Objective.create({
          id: 1,
          title: 'Objective test 1',
          description: 'objective description 1',
          state: 'activo',
          area: 'diseño',
          priority: 1,
          projectId: 1,
          createdAt: '2024-01-02',
          createdBy: 'zitadel-sub-01'
        });
      })
      .then(() => {
        return Promise.all([
          ObjectiveActivity.create({
            id: 1,
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'comment',
            previousValue: '',
            newValue: 'New Comment',
            objectiveId: 1
          }),
          ObjectiveActivity.create({
            id: 2,
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'priority',
            previousValue: '0',
            newValue: '1',
            objectiveId: 1,
          }),
          ObjectiveActivity.create({
            id: 3,
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'area',
            previousValue: '',
            newValue: 'desarrollo',
            objectiveId: 1,
          })
        ]);
      });
  });

  after(() => {
    return ObjectiveActivity.destroy({where: {}})
      .then(() => {
        return Objective.destroy({where: {}});
      })
      .then(() => {
        return Project.destroy({where: {}});
      })
      .then(() => {
        return User.destroy({where: {}});
      });
  });

  it('should fail with update with a non-existent comment id', () => {
    return request(application)
      .patch('/api/objectives/1/comment/4')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        comment: 'Edited comment'
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.be.equal('comment_not_found');
        response.body.message.should.be.equal('Comment not found');
      });
  });

  it('should fail with update with a unautorized user', () => {
    return request(application)
      .patch('/api/objectives/1/comment/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_02_user')
      .send({
        comment: 'Edited comment'
      })
      .expect(403)
      .then((response) => {
        response.body.code.should.be.equal('forbidden');
        response.body.message.should.be.equal('You do not have permission to edit this comment');
      });
  });

  it('should update a comment', () => {
    return request(application)
      .patch('/api/objectives/1/comment/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        comment: 'Edited comment'
      })
      .expect(200)
      .then((response) => {
        response.body.code.should.be.equal('comment_updated');
        response.body.message.should.be.equal('Comment Updated');

        return ObjectiveActivity.findAll();
      })
      .then((activities) => {
        const expectedObject = [
          { changedBy: 'zitadel-sub-01', typeOfActivity: 'comment', previousValue: 'New Comment', newValue: 'Edited comment' },
          { changedBy: 'zitadel-sub-01', typeOfActivity: 'priority', previousValue: '0', newValue: '1' },
          { changedBy: 'zitadel-sub-01', typeOfActivity: 'area', previousValue: '', newValue: 'desarrollo' },
        ];
        activities.should.containDeep(expectedObject);
        activities.length.should.be.equal(3);
      });
  });
});
