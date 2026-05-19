import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
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
