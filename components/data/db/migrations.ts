import { schemaMigrations, addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 7,
      steps: [
        addColumns({
          table: 'orders',
          columns: [
            { name: 'discount_type', type: 'string', isOptional: true },
            { name: 'discount_value', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 6,
      steps: [
        createTable({
          name: 'inventory_logs',
          columns: [
            { name: 'product_id', type: 'string', isIndexed: true },
            { name: 'type', type: 'string' },
            { name: 'quantity', type: 'number' },
            { name: 'reason', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'orders',
          columns: [
            { name: 'payment_method', type: 'string', isOptional: true },
            { name: 'bank_name', type: 'string', isOptional: true },
            { name: 'card_last_four', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'products',
          columns: [
            { name: 'icon_pending_upload', type: 'boolean', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'businesses',
          columns: [
            { name: 'logo_uri', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'products',
          columns: [
            { name: 'is_favorite', type: 'boolean', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
