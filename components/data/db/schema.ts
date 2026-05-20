import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 4,
  tables: [
    tableSchema({
      name: 'businesses',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'business_type', type: 'string' },
        { name: 'address', type: 'string', isOptional: true },
        { name: 'phone_number', type: 'string' },
        { name: 'tax_id', type: 'string', isOptional: true },
        { name: 'operating_hours', type: 'string', isOptional: true },
        { name: 'logo_uri', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'employees',
      columns: [
        { name: 'business_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'role', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'email', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'products',
      columns: [
        { name: 'business_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'sku', type: 'string', isOptional: true },
        { name: 'quick_code', type: 'string', isOptional: true, isIndexed: true },
        { name: 'barcode', type: 'string', isOptional: true, isIndexed: true },
        { name: 'category', type: 'string', isOptional: true },
        { name: 'unit_type', type: 'string', isOptional: true },
        { name: 'cost_price', type: 'number', isOptional: true },
        { name: 'price', type: 'number' },
        { name: 'stock_count', type: 'number' },
        { name: 'low_stock_alert', type: 'number', isOptional: true },
        { name: 'icon', type: 'string', isOptional: true },
        { name: 'is_favorite', type: 'boolean', isOptional: true },
        { name: 'icon_pending_upload', type: 'boolean', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'orders',
      columns: [
        { name: 'business_id', type: 'string', isIndexed: true },
        { name: 'invoice_number', type: 'string', isIndexed: true },
        { name: 'total_amount', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'order_items',
      columns: [
        { name: 'order_id', type: 'string', isIndexed: true },
        { name: 'product_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'name', type: 'string' },
        { name: 'quantity', type: 'number' },
        { name: 'price', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
