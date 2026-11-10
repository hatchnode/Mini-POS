/**
 * Staff sign-in. With no staff set up the app works as before and anyone can do anything. Once
 * staff exist, the app asks who is working (name + PIN), stamps orders and payments with that
 * name, and keeps the sensitive actions for managers: voids, walk-outs, removing dishes already
 * sent to the kitchen, and the Sales, Menu and Settings screens. A staff member can still do
 * those with a manager's PIN.
 *
 * PINs are a deterrent on a shared tablet, not strong security: they are stored scrambled, but
 * everything lives in this browser and a 4-digit PIN can be guessed.
 */
import { PIN_LENGTH } from '../config.js';
import { uid } from '../utils/id.js';

export const ROLE_LABEL = { manager: 'Manager', staff: 'Staff' };
/** Screens only managers can open. */
export const MANAGER_VIEWS = ['sales', 'menu', 'settings'];

export const isValidPin = (pin) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(String(pin));

/** Scramble a PIN so it isn't readable in the stored data or in a backup file. */
export function hashPin(pin, salt) {
  let h = 0x811c9dc5;
  const text = `${salt}:${pin}:mini-pos`;
  for (let round = 0; round < 64; round++) {
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i) + round;
      h = Math.imul(h, 0x01000193);
    }
  }
  return (h >>> 0).toString(36);
}

export const staffEnabled = (data) => (data.staff || []).length > 0;
export const findStaff = (data, id) => (data.staff || []).find((s) => s.id === id) || null;
export const isManager = (member) => member?.role === 'manager';
const managerCount = (data) => data.staff.filter(isManager).length;

const nameTaken = (data, name, exceptId) =>
  data.staff.some((s) => s.id !== exceptId && s.name.toLowerCase() === name.toLowerCase());

/** Add a staff member. The first one is always a manager, so somebody can manage the rest. */
export function addStaff(data, { name = '', pin = '', role = 'staff' }) {
  const finalName = name.trim();
  if (!finalName) return { ok: false, error: 'Enter a name' };
  if (nameTaken(data, finalName))
    return { ok: false, error: `There is already someone called "${finalName}"` };
  if (!isValidPin(pin)) return { ok: false, error: `The PIN must be ${PIN_LENGTH} digits` };
  const id = uid();
  const member = {
    id,
    name: finalName,
    role: data.staff.length === 0 || role === 'manager' ? 'manager' : 'staff',
    pin: hashPin(pin, id),
  };
  data.staff.push(member);
  return { ok: true, member };
}

export function setStaffRole(data, id, role) {
  const member = findStaff(data, id);
  if (!member) return { ok: false, error: 'Staff member not found' };
  if (isManager(member) && role !== 'manager' && managerCount(data) === 1)
    return { ok: false, error: 'There must be at least one manager' };
  member.role = role === 'manager' ? 'manager' : 'staff';
  return { ok: true, member };
}

export function setStaffPin(data, id, pin) {
  const member = findStaff(data, id);
  if (!member) return { ok: false, error: 'Staff member not found' };
  if (!isValidPin(pin)) return { ok: false, error: `The PIN must be ${PIN_LENGTH} digits` };
  member.pin = hashPin(pin, member.id);
  return { ok: true, member };
}

/** Remove a staff member. The last manager can only go when nobody else is left. */
export function removeStaff(data, id) {
  const member = findStaff(data, id);
  if (!member) return { ok: false, error: 'Staff member not found' };
  if (isManager(member) && managerCount(data) === 1 && data.staff.length > 1)
    return { ok: false, error: 'Make someone else a manager first, or remove the other staff' };
  data.staff = data.staff.filter((s) => s !== member);
  return { ok: true, member };
}

export const checkPin = (member, pin) => !!member && member.pin === hashPin(pin, member.id);

/** The manager this PIN belongs to, or null. Used when a manager approves a staff action. */
export const managerByPin = (data, pin) =>
  (data.staff || []).find((s) => isManager(s) && checkPin(s, pin)) || null;
