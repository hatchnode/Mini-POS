import { describe, expect, it } from 'vitest';
import {
  addStaff,
  checkPin,
  hashPin,
  isValidPin,
  managerByPin,
  removeStaff,
  setStaffPin,
  setStaffRole,
  staffEnabled,
} from '../src/domain/staff.js';
import { logEvent, recentLog } from '../src/domain/log.js';

const team = () => {
  const data = { staff: [] };
  const owner = addStaff(data, { name: 'Ana', pin: '1234', role: 'staff' }).member;
  const waiter = addStaff(data, { name: 'Ben', pin: '5678' }).member;
  return { data, owner, waiter };
};

describe('staff', () => {
  it('is off until someone is added, and the first person is a manager', () => {
    const data = { staff: [] };
    expect(staffEnabled(data)).toBe(false);
    const { owner, waiter } = team();
    expect([owner.role, waiter.role]).toEqual(['manager', 'staff']);
  });

  it('validates names and PINs', () => {
    const { data } = team();
    expect(addStaff(data, { name: ' ', pin: '1111' }).ok).toBe(false);
    expect(addStaff(data, { name: 'ana', pin: '1111' }).ok).toBe(false);
    expect(addStaff(data, { name: 'Cy', pin: '12' }).ok).toBe(false);
    expect([isValidPin('0000'), isValidPin('12345'), isValidPin('12a4')]).toEqual([true, false, false]);
  });

  it('never stores the PIN itself and checks it per person', () => {
    const { owner, waiter } = team();
    expect(owner.pin).not.toContain('1234');
    expect(hashPin('1234', 'a')).not.toBe(hashPin('1234', 'b'));
    expect([checkPin(owner, '1234'), checkPin(owner, '5678'), checkPin(waiter, '5678')]).toEqual([
      true,
      false,
      true,
    ]);
  });

  it('accepts only a manager PIN for approvals', () => {
    const { data, owner } = team();
    expect(managerByPin(data, '1234')).toBe(owner);
    expect(managerByPin(data, '5678')).toBe(null);
  });

  it('keeps at least one manager while other staff remain', () => {
    const { data, owner, waiter } = team();
    expect(setStaffRole(data, owner.id, 'staff').ok).toBe(false);
    expect(removeStaff(data, owner.id).ok).toBe(false);
    expect(setStaffRole(data, waiter.id, 'manager').ok).toBe(true);
    expect(removeStaff(data, owner.id).ok).toBe(true);
    expect(removeStaff(data, waiter.id).ok).toBe(true);
    expect(staffEnabled(data)).toBe(false);
  });

  it('changes a PIN', () => {
    const { data, waiter } = team();
    expect(setStaffPin(data, waiter.id, 'x').ok).toBe(false);
    expect(setStaffPin(data, waiter.id, '0000').ok).toBe(true);
    expect([checkPin(waiter, '5678'), checkPin(waiter, '0000')]).toEqual([false, true]);
  });
});

describe('activity log', () => {
  it('keeps the newest entries, newest first', () => {
    const data = { log: [] };
    for (let i = 0; i < 510; i++) logEvent(data, 'void', `entry ${i}`, 'Ana', i);
    expect(data.log.length).toBe(500);
    expect(recentLog(data, 2).map((e) => e.text)).toEqual(['entry 509', 'entry 508']);
  });
});
