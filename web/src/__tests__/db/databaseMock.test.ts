import { describe, test, expect } from 'vitest';
import databaseMock, { schema } from '../../db/__mocks__/database';

describe('databaseMock fallback coverage', () => {
  test('should return default fallback collection for unknown table names', () => {
    const fallbackCol = databaseMock.get('nonexistent_table');
    expect(fallbackCol.query).toBeDefined();
    expect(fallbackCol.create).toBeDefined();
  });

  test('should execute the callback in default write implementation', async () => {
    let executed = false;
    await databaseMock.write(async () => {
      executed = true;
    });
    expect(executed).toBe(true);
    expect(schema.version).toBe(8);
  });
});
