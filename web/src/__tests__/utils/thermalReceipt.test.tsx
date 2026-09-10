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

  // ESC 3 n sets the line-feed pitch. Without it the printer stays on its own
  // 1/6in default (~34 dots) while font A is 24 tall, and every line wastes ~10
  // dots of paper. The option is silently ignored by chittie < 0.5.10, so assert
  // the byte rather than the call.
  test('sets the line-feed pitch so the printer default does not pad every line', async () => {
    const data = await renderReceiptBytes({
      order,
      items,
      activeBusiness: business,
      changeDue: 50,
    });
    expect(containsSequence(data, [0x1b, 0x33, 24])).toBe(true);
  });

  // GS ! n — the low nibble is the height multiplier, the high nibble the width.
  const GS_SIZE = (width: number, height: number) => [
    0x1d,
    0x21,
    ((width - 1) << 4) | (height - 1),
  ];

  test('prints the business name larger than the body, and the total larger than the subtotal', async () => {
    const data = await renderReceiptBytes({
      order,
      items,
      activeBusiness: business,
      changeDue: 50,
    });
    expect(containsSequence(data, GS_SIZE(2, 2))).toBe(true);
    expect(containsSequence(data, GS_SIZE(1, 2))).toBe(true);
  });

  test('spends no line on a paid status, and cannot hide a voided one', async () => {
    const base = { items, activeBusiness: business, changeDue: 50 };
    const paid = await renderReceiptBytes({ ...base, order });
    const voided = await renderReceiptBytes({ ...base, order: { ...order, status: 'voided' } });
    const text = (d: Uint8Array) => String.fromCharCode(...Array.from(d));
    expect(text(paid)).not.toContain('Status');
    expect(text(voided)).toContain('VOIDED');
  });

  test('date and time share one row, and the cashier does not get one', async () => {
    const data = await renderReceiptBytes({
      order,
      items,
      activeBusiness: business,
      changeDue: 50,
    });
    const text = String.fromCharCode(...Array.from(data));
    expect(text).toContain('2026-06-22 14:30');
    expect(text).not.toContain('Cashier');
  });

  test('58mm and 80mm profiles both render and produce different bytes', async () => {
    const base = { order, items, activeBusiness: business, changeDue: 50 };
    const narrow = await renderReceiptBytes({ ...base, profile: '58mm' });
    const wide = await renderReceiptBytes({ ...base, profile: '80mm' });
    expect(narrow.length).toBeGreaterThan(0);
    expect(wide.length).toBeGreaterThan(0);
    expect(Array.from(narrow)).not.toEqual(Array.from(wide));
  });

  // The reported defect: on a 58mm roll '1x Raththi milk powder' (22 chars) plus
  // 'Rs. 120.00' (10) filled the line exactly, so the price printed hard against
  // the product name with nothing between them.
  test('a product name never runs into its amount, at either width', async () => {
    const decode = (data: Uint8Array) =>
      Buffer.from(data)
        .toString('latin1')
        .replace(/\x1b./g, '')
        .replace(/\x1d!./g, '')
        .split('\n')
        .map((l) => l.replace(/\r/g, ''));

    for (const profile of ['58mm', '80mm'] as const) {
      const data = await renderReceiptBytes({
        order: {
          invoiceNumber: 'INV-410485',
          totalAmount: 660,
          paymentMethod: 'cash',
          discountValue: 0,
          taxValue: 0,
          taxRate: 0,
          dateStr: '27/07/2026 17:11',
          cashierName: 'Owner / Admin',
          status: 'paid',
          cashReceived: 1000,
        },
        items: [
          { name: 'Raththi milk powder', price: 120, quantity: 1 },
          { name: 'Kothmale fresh milk - 500 ml', price: 540, quantity: 1 },
        ],
        activeBusiness: {
          name: 'Xustore',
          address: 'Galle road, Nupe, Matara',
          phone: '713750843',
        },
        changeDue: 340,
        profile,
      });

      for (const line of decode(data)) {
        // A non-space immediately followed by the amount means they collided.
        expect(line, `${profile}: ${JSON.stringify(line)}`).not.toMatch(/\S(?=Rs\.)/);
      }
    }
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
