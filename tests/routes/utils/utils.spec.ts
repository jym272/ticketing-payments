import { test, expect } from '@playwright/test';
import { utils } from '@jym272ticketing/common';
const { httpStatusCodes, logFinished, logRunning } = utils;

// eslint-disable-next-line no-empty-pattern -- because we need to pass only the testInfo
test.beforeEach(({}, testInfo) => logRunning(testInfo));

// eslint-disable-next-line no-empty-pattern -- because we need to pass only the testInfo
test.afterEach(({}, testInfo) => logFinished(testInfo));

test.describe('routes: utils', () => {
  test('get health route', async ({ request }) => {
    const response = await request.get('/health');
    const body = await response.body();

    expect(response.ok()).toBe(true);
    expect(body.toString()).toBe('OK');
    expect(response.status()).toBe(httpStatusCodes.OK);
  });
  test('get env route, compare PORT', async ({ request }) => {
    const response = await request.get('/env');
    const body = await response.body();
    // https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type
    const envObject = JSON.parse(body.toString()) as Record<string, string>;

    expect(envObject.PORT).toBe(process.env.PORT);
    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(httpStatusCodes.OK);
  });
  test('wildcard route', async ({ request }) => {
    const randomString = Math.random().toString(36).substring(7);
    const response = await request.get(`/${randomString}`);
    const body = await response.body();
    expect(response.ok()).toBe(false);
    const { message } = JSON.parse(body.toString()) as { message: string };
    expect(message).toBe('Not Found.');
    expect(response.status()).toBe(httpStatusCodes.NOT_FOUND);
  });
  test('get api healthz route, success if nats is connected', async ({ request }) => {
    const response = await request.get('/api/healthz');
    const { status } = (await response.json()) as { status: 'ok' | 'error' };
    expect(response.ok()).toBe(true);
    expect(status).toBe('ok');
    expect(response.status()).toBe(httpStatusCodes.OK);
  });
});
