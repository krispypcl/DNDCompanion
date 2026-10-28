import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type pg from 'pg';
import { asUser, freshDatabase, hasDatabase, makeUser } from './db';

const ALICE = '11111111-1111-1111-1111-111111111111';
const BOB = '22222222-2222-2222-2222-222222222222';

describe.skipIf(!hasDatabase)('sheets row-level security', () => {
  let db: pg.Client;
  let sheetId: string;

  beforeAll(async () => {
    db = await freshDatabase();
    await makeUser(db, ALICE);
    await makeUser(db, BOB);
    const created = await asUser<{ id: string }>(
      db,
      ALICE,
      `insert into sheets (owner_id, name) values ($1, 'Loka Sibbs') returning id`,
      [ALICE]
    );
    sheetId = created.rows[0].id;
  });

  afterAll(async () => {
    await db?.end();
  });

  test('anonymous can read any sheet', async () => {
    const result = await asUser(db, null, 'select id from sheets where id = $1', [sheetId]);
    expect(result.rowCount).toBe(1);
  });

  // Refused by the table grant before RLS is even reached — anon holds no
  // INSERT privilege. Either mechanism is an acceptable refusal.
  test('anonymous cannot insert a sheet', async () => {
    await expect(
      asUser(db, null, `insert into sheets (owner_id, name) values ($1, 'Forged')`, [ALICE])
    ).rejects.toThrow(/row-level security|permission denied/i);
  });

  test('owner can update own sheet', async () => {
    const result = await asUser(db, ALICE, `update sheets set name = 'Renamed' where id = $1`, [
      sheetId
    ]);
    expect(result.rowCount).toBe(1);
  });

  test('non-owner cannot update another sheet', async () => {
    const result = await asUser(db, BOB, `update sheets set name = 'Hijacked' where id = $1`, [
      sheetId
    ]);
    expect(result.rowCount).toBe(0);
  });

  test('non-owner cannot delete another sheet', async () => {
    const result = await asUser(db, BOB, 'delete from sheets where id = $1', [sheetId]);
    expect(result.rowCount).toBe(0);
  });

  test('a user cannot insert a sheet owned by someone else', async () => {
    await expect(
      asUser(db, BOB, `insert into sheets (owner_id, name) values ($1, 'Forged')`, [ALICE])
    ).rejects.toThrow(/row-level security|permission denied/i);
  });
});
