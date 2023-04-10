import { test, expect } from '@playwright/test';
import { utils } from '@jym272ticketing/common';
const { httpStatusCodes, logFinished, logRunning } = utils;

// eslint-disable-next-line no-empty-pattern -- because we need to pass only the testInfo
test.beforeEach(({}, testInfo) => logRunning(testInfo));

// eslint-disable-next-line no-empty-pattern -- because we need to pass only the testInfo
test.afterEach(({}, testInfo) => logFinished(testInfo));

test.describe('routes: home', () => {
  test('get home route', async ({ request }) => {
    const response = await request.get('/');
    const body = await response.body();
    expect(response.ok()).toBe(true);
    expect(body.toString()).toBe('Hello there!');
    expect(response.status()).toBe(httpStatusCodes.OK);
  });
});
