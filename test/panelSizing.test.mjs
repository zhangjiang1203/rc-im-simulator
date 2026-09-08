import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_COMPOSE_RATIO,
  MIN_COMPOSE_WIDTH,
  MIN_LOG_WIDTH,
  clampComposeWidth,
  getDefaultComposeWidth,
} from '../src/utils/panelSizing.js';

test('默认宽度让消息编辑区占可用空间的六成', () => {
  assert.equal(DEFAULT_COMPOSE_RATIO, 0.6);
  assert.equal(getDefaultComposeWidth(1480), 888);
});

test('默认宽度始终为日志区保留至少 440px', () => {
  assert.equal(MIN_LOG_WIDTH, 440);
  assert.equal(getDefaultComposeWidth(1000), 560);
});

test('拖拽不会让日志区小于最小宽度', () => {
  assert.equal(clampComposeWidth(1200, 900), 760);
});

test('拖拽不会让消息编辑区小于可用宽度下限', () => {
  assert.equal(clampComposeWidth(1200, 200), MIN_COMPOSE_WIDTH);
});
