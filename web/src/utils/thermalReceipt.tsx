import React from 'react';
import {
  Printer,
  Text,
  Row,
  Line,
  Br,
  Cut,
  Cashdraw,
  render,
  PRINTER_PROFILES,
  type TextRasterizer,
} from '@angadie/chittie';
import { buildReceiptModel, formatMoney, type ReceiptModelInput } from './receiptModel';

export type CashDrawerPin = '2pin' | '5pin';

export type RenderReceiptParams = ReceiptModelInput & {
  /** Characters per line — 32 for 58mm rolls, 48 for 80mm rolls. */
  widthChars?: number;
  /** When true, prepend a cash-drawer kick so the drawer opens as the receipt prints. */
  openCashDrawer?: boolean;
  cashDrawerPin?: CashDrawerPin;
};

// react-thermal-printer's '2pin'/'5pin' → chittie's pulse device (0 = connector pin 2, 1 = pin 5).
const drawerDevice = (pin: CashDrawerPin = '2pin') => (pin === '5pin' ? 1 : 0);

// 32 cols → 58mm (384 dots), else 80mm (576 dots).
const profileFor = (widthChars: number) =>
  widthChars <= 32 ? PRINTER_PROFILES['58mm'] : PRINTER_PROFILES['80mm'];

/**
 * Browser rasterizer — shapes Sinhala/Tamil/etc. via the OS fonts so non-Latin
 * receipts print correctly (the old UTF-8 path printed garbage on ESC/POS). Only
 * invoked for text a code page can't represent; Latin/English never touches it
 * (so Node tests / Latin previews need no canvas). Tight crop = clean line spacing.
 */
export const browserRasterizer: TextRasterizer = {
  rasterize(text, { fontSize = 24, maxWidth = 576, bold = false } = {}) {
    if (typeof document === 'undefined') {
      throw new Error('thermalReceipt: non-Latin text needs a browser canvas (no document here)');
    }
    const font = `${bold ? 'bold ' : ''}${fontSize}px "Noto Sans Sinhala","Noto Sans Tamil",sans-serif`;
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.font = font;
    const m = probe.measureText(text);
    const ascent = Math.ceil(m.actualBoundingBoxAscent || fontSize * 0.8);
    const descent = Math.ceil(m.actualBoundingBoxDescent || fontSize * 0.22);
    const w = Math.min(Math.ceil(m.width) + 4, maxWidth);
    const h = ascent + descent + 2;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    ctx.font = font;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, 2, ascent + 1);
    return ctx.getImageData(0, 0, w, h) as unknown as ImageData;
  },
};

export function buildReceiptElement(params: RenderReceiptParams) {
  const { columns } = profileFor(params.widthChars ?? 48);
  const m = buildReceiptModel(params);

  return (
    <Printer width={columns}>
      {params.openCashDrawer ? <Cashdraw device={drawerDevice(params.cashDrawerPin)} /> : null}
      <Text align="center" bold>
        {m.businessName}
      </Text>
      <Text align="center">{m.businessAddress}</Text>
      {m.businessPhone ? <Text align="center">Tel: {m.businessPhone}</Text> : null}

      <Line />

      <Row left="Invoice" right={m.invoiceNumber} />
      <Row left="Cashier" right={m.cashierName} />
      <Row left="Date" right={m.date} />
      {m.time ? <Row left="Time" right={m.time} /> : null}
      <Row left="Status" right={m.status} />

      <Line />

      {m.items.map((it, i) => (
        <Row key={i} left={`${it.quantity} x ${it.name}`} right={formatMoney(it.lineTotal)} />
      ))}

      <Line />

      <Row left="Subtotal" right={formatMoney(m.subtotal)} />
      {m.discount ? (
        <>
          <Row left={m.discount.label} right={`- ${formatMoney(m.discount.amount)}`} />
          <Row left="Net Subtotal" right={formatMoney(m.discount.netSubtotal)} />
        </>
      ) : null}
      {m.tax ? <Row left={m.tax.label} right={formatMoney(m.tax.amount)} /> : null}

      <Line />

      <Row left="TOTAL" right={formatMoney(m.total)} />

      <Line />

      <Row left="Payment" right={m.paymentMethod.toUpperCase()} />
      {m.cashTendered !== null ? (
        <>
          <Row left="Cash Tendered" right={formatMoney(m.cashTendered)} />
          <Row left="Change Due" right={formatMoney(m.changeDue ?? 0)} />
        </>
      ) : null}
      {m.cardLabel ? <Row left="Card / Bank" right={m.cardLabel} /> : null}
      {m.bankName ? <Row left="Bank" right={m.bankName} /> : null}

      <Br />

      {m.footer.map((line, i) => (
        <Text key={i} align="center" small>
          {line}
        </Text>
      ))}

      <Cut />
    </Printer>
  );
}

const renderOpts = (widthChars: number) => ({
  dotWidth: profileFor(widthChars).dotWidth,
  rasterizer: browserRasterizer,
  codepage: 'cp437' as const,
});

export async function renderReceiptBytes(params: RenderReceiptParams): Promise<Uint8Array> {
  return render(buildReceiptElement(params), renderOpts(params.widthChars ?? 48));
}

/** ESC/POS bytes that just kick the cash drawer (no print), for an on-demand open. */
export async function renderCashDrawerBytes(pin: CashDrawerPin = '2pin'): Promise<Uint8Array> {
  return render(
    <Printer width={48}>
      <Cashdraw device={drawerDevice(pin)} />
    </Printer>,
    renderOpts(48)
  );
}

/** Minimal sample receipt used to verify printer alignment from settings. */
export function renderTestReceiptBytes(
  activeBusiness: ReceiptModelInput['activeBusiness'],
  widthChars = 48
): Promise<Uint8Array> {
  return renderReceiptBytes({
    order: {
      invoiceNumber: 'TEST-PRINT',
      totalAmount: 1123.2,
      paymentMethod: 'cash',
      discountValue: 0,
      taxValue: 83.2,
      taxRate: 8,
      dateStr: new Date().toLocaleString('en-GB'),
      cashierName: 'Test',
      status: 'paid',
      cashReceived: 1200,
    },
    items: [
      { name: 'Anchor Milk 1L', price: 680, quantity: 1 },
      { name: 'Marie Biscuits', price: 180, quantity: 2 },
    ],
    activeBusiness,
    changeDue: 76.8,
    widthChars,
  });
}
