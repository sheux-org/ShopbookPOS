import { describe, test, expect } from 'vitest';
import {
  renderReceiptBytes,
  renderTestReceiptBytes,
  renderCashDrawerBytes,
} from '../../utils/thermalReceipt';

// ESC/POS cash-drawer kick command begins with ESC p (0x1B 0x70).
function containsSequence(data: Uint8Array, seq: number[]): boolean {
  const arr = Array.from(data);
  for (let i = 0; i + seq.length <= arr.length; i++) {
    if (seq.every((b, j) => arr[i + j] === b)) return true;
  }
  return false;
}

const order = {
  invoiceNumber: 'INV-1001 (Staff: Alice)',
  totalAmount: 950,
  paymentMethod: 'cash',
  discountValue: 50,
  discountType: 'flat',
  taxValue: 80,
  taxRate: 8,
  dateStr: '2026-06-22 14:30',
  cashierName: 'Alice',
  status: 'paid',
  cashReceived: 1000,
};

const items = [
  { name: 'Coffee', price: 500, quantity: 1 },
  { name: 'Sandwich', price: 200, quantity: 2 },
];

const business = { name: 'Test Cafe', address: 'Colombo', phone: '0712345678' };

describe('thermalReceipt', () => {
  test('renderReceiptBytes returns non-empty ESC/POS data', async () => {
    const data = await renderReceiptBytes({
      order,
      items,
      activeBusiness: business,
      changeDue: 50,
    });
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBeGreaterThan(0);
    // ESC @ initialize sequence should be present.
    expect(Array.from(data)).toEqual(expect.arrayContaining([0x1b, 0x40]));
  });

  test('58mm and 80mm profiles both render and produce different bytes', async () => {
    const base = { order, items, activeBusiness: business, changeDue: 50 };
    const narrow = await renderReceiptBytes({ ...base, profile: '58mm' });
    const wide = await renderReceiptBytes({ ...base, profile: '80mm' });
    expect(narrow.length).toBeGreaterThan(0);
    expect(wide.length).toBeGreaterThan(0);
    expect(Array.from(narrow)).not.toEqual(Array.from(wide));
  });

  test('renderTestReceiptBytes produces data', async () => {
    const data = await renderTestReceiptBytes(business, '80mm');
    expect(data.length).toBeGreaterThan(0);
  });

  test('renderCashDrawerBytes emits the ESC/POS drawer-kick command on both pins', async () => {
    for (const device of [0, 1]) {
      const data = await renderCashDrawerBytes(device);
      expect(data.length).toBeGreaterThan(0);
      expect(containsSequence(data, [0x1b, 0x70, device])).toBe(true);
    }
  });

  test('every receipt carries the ESC/POS init and cut markers', async () => {
    const data = await renderReceiptBytes({
      order,
      items,
      activeBusiness: business,
      changeDue: 50,
    });
    expect(containsSequence(data, [0x1b, 0x40])).toBe(true); // ESC @  initialize
    expect(containsSequence(data, [0x1d, 0x56])).toBe(true); // GS V   cut
  });

  test('openCashDrawer flag prepends a drawer kick to the receipt', async () => {
    const base = { order, items, activeBusiness: business, changeDue: 50 };
    const without = await renderReceiptBytes(base);
    const withKick = await renderReceiptBytes({ ...base, openCashDrawer: true });
    expect(containsSequence(without, [0x1b, 0x70])).toBe(false);
    expect(containsSequence(withKick, [0x1b, 0x70])).toBe(true);
    expect(withKick.length).toBeGreaterThan(without.length);
  });
});
