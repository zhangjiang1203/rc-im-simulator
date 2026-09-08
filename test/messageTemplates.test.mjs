import assert from 'node:assert/strict';
import test from 'node:test';
import { MESSAGE_TYPES } from '../src/utils/messageTemplates.js';

test('文本消息携带默认用户和装扮信息', () => {
  const textTemplate = MESSAGE_TYPES.find(({ value }) => value === 'RC:TxtMsg');
  const payload = textTemplate.buildContent({ ...textTemplate.defaultValues, content: 'Hhhhhhha' });
  const extra = JSON.parse(payload.extra);

  assert.deepEqual(JSON.parse(textTemplate.defaultValues.user), {
    id: '1300000077',
    name: 'wolaile',
    portrait: 'https://img.hektarapp.io/orj360/4d7c6d4dla1idywe65uvvj20j60j60tw.jpg',
  });
  assert.equal(JSON.parse(textTemplate.defaultValues.extra).hostUid, '1300000139');
  assert.deepEqual(payload.user, {
    id: '1300000077',
    name: 'wolaile',
    portrait: 'https://img.hektarapp.io/orj360/4d7c6d4dla1idywe65uvvj20j60j60tw.jpg',
  });
  assert.equal(payload.content, 'Hhhhhhha');
  assert.equal(extra.ts, 1788264947027);
  assert.equal(extra.hostUid, '1300000139');
  assert.deepEqual(extra.badge_list, [2, 4]);
  assert.equal(extra.user_decorator.entry_notice_id, 30003);
  assert.equal(extra.user_decorator.little_badge_v2[2].little_badge_id, 41004);
});
