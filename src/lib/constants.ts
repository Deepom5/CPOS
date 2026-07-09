/**
 * App-wide constants. Until a real tenant/location is provisioned via the
 * backend, the seed installs a single demo tenant + location and the app
 * always operates inside it. These ids match the values used by the seeder.
 */
export const DEMO_TENANT_ID = '01900000-0000-7000-8000-000000000001';
export const DEMO_LOCATION_ID = '01900000-0000-7000-8000-000000000002';
export const DEMO_DEVICE_ID = '01900000-0000-7000-8000-000000000003';
export const DEMO_EMPLOYEE_ID = '01900000-0000-7000-8000-000000000004';

export const DB_NAME = 'cpos.db';
export const DEFAULT_TAX_RATE_PERCENT = 8;
export const DEFAULT_CURRENCY = 'USD';
