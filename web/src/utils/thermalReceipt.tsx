import React from 'react';
import { Printer, Text, Row, Line, Br, Cut, Cashdraw, render } from 'react-thermal-printer';
import type { CashDrawerPin } from 'react-thermal-printer';
import { buildReceiptModel, formatMoney, type ReceiptModelInput } from './receiptModel';

export type RenderReceiptParams = ReceiptModelInput & {
  /** Characters per line — 32 for 58mm rolls, 48 for 80mm rolls. */
  widthChars?: number;
  /** When true, prepend a cash-drawer kick so the drawer opens as the receipt prints. */
  openCashDrawer?: boolean;
  cashDrawerPin?: CashDrawerPin;
};

// UTF-8 encoder bypasses iconv-lite's codepage path; our receipts are Latin/English.
const utf8Encoder = (text: string) => new TextEncoder().encode(text);

export function buildReceiptElement(params: RenderReceiptParams) {
  const widthChars = params.widthChars ?? 48;
  const m = buildReceiptModel(params);

  return (
    <Printer type="epson" width={widthChars} encoder={utf8Encoder}>
      {params.openCashDrawer ? <Cashdraw pin={params.cashDrawerPin ?? '2pin'} /> : null}
      <Text align="center" bold={true}>
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

      <Row
        left={<Text bold={true}>TOTAL</Text>}
        right={<Text bold={true}>{formatMoney(m.total)}</Text>}
      />

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
        <Text key={i} align="center">
          {line}
        </Text>
      ))}

      <Cut />
    </Printer>
  );
}

export function renderReceiptBytes(params: RenderReceiptParams): Promise<Uint8Array> {
  return render(buildReceiptElement(params));
}

/** ESC/POS bytes that just kick the cash drawer (no print), for an on-demand open. */
export function renderCashDrawerBytes(pin: CashDrawerPin = '2pin'): Promise<Uint8Array> {
  return render(
    <Printer type="epson" encoder={utf8Encoder}>
      <Cashdraw pin={pin} />
    </Printer>
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
