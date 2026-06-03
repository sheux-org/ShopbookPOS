function escapeHtml(s: string): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export type ReportType =
  | "best_sellers"
  | "slow_movers"
  | "orders_ledger"
  | "item_sales"
  | "branch_performance";

export interface ReportData {
  business: {
    name: string;
    category?: string;
    address?: string;
    phone?: string;
  };
  orders: any[];
  orderItems: any[];
  products: any[];
}

export function buildReportHtml(type: ReportType, data: ReportData): string {
  const { business, orders, orderItems, products } = data;
  const businessName = escapeHtml(business.name);
  const businessCategory = escapeHtml(business.category || "General Store");
  const businessAddress = escapeHtml(business.address || "No Address Provided");
  const businessPhone = escapeHtml(business.phone || "No Telephone");
  const generatedDate = new Date().toLocaleString();

  // Helper calculations
  const totalSales = orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  const totalOrdersCount = orders.length;
  const avgBasket = totalOrdersCount > 0 ? totalSales / totalOrdersCount : 0;

  // Let's build specific details for each report type
  let reportTitle = "";
  let kpiCardsHtml = "";
  let contentHtml = "";

  if (type === "best_sellers") {
    reportTitle = "Best Selling Products Report";

    // Build Product sales map
    const productSales: Record<string, { sku: string; category: string; quantity: number; revenue: number; price: number }> = {};
    for (const item of orderItems) {
      const name = item.name || "Unknown Item";
      if (!productSales[name]) {
        productSales[name] = { sku: item.sku || "N/A", category: item.category || "General", quantity: 0, revenue: 0, price: item.price || 0 };
      }
      productSales[name].quantity += item.quantity || 0;
      productSales[name].revenue += (item.quantity || 0) * (item.price || 0);
    }

    const sortedBest = Object.keys(productSales)
      .map(name => ({ name, ...productSales[name] }))
      .sort((a, b) => b.quantity - a.quantity);

    const totalUnitsSold = sortedBest.reduce((acc, p) => acc + p.quantity, 0);

    // KPI Cards
    kpiCardsHtml = `
      <div class="kpi-card">
        <div class="kpi-label">Unique Products Sold</div>
        <div class="kpi-value">${sortedBest.length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Units Distributed</div>
        <div class="kpi-value">${totalUnitsSold} units</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Top Seller Revenue</div>
        <div class="kpi-value">Rs. ${(sortedBest[0]?.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>
    `;

    // Table
    let rowsHtml = sortedBest.length > 0 
      ? sortedBest.map((p, idx) => {
          const share = totalSales > 0 ? (p.revenue / totalSales) * 100 : 0;
          return `
            <tr>
              <td><span class="badge ${idx === 0 ? "gold" : idx === 1 ? "silver" : idx === 2 ? "bronze" : "gray"}">${idx + 1}</span></td>
              <td><strong>${escapeHtml(p.name)}</strong></td>
              <td>${escapeHtml(p.sku)}</td>
              <td>${escapeHtml(p.category)}</td>
              <td class="text-right">${p.quantity}</td>
              <td class="text-right">Rs. ${p.price.toFixed(2)}</td>
              <td class="text-right bold">Rs. ${p.revenue.toFixed(2)}</td>
              <td class="text-right">${share.toFixed(1)}%</td>
            </tr>
          `;
        }).join("")
      : `<tr><td colspan="8" class="text-center">No sales data recorded in the database.</td></tr>`;

    contentHtml = `
      <h3>Sales Ranking Ledger</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 50px;">Rank</th>
            <th>Product Name</th>
            <th>SKU</th>
            <th>Category</th>
            <th class="text-right">Units Sold</th>
            <th class="text-right">Unit Price</th>
            <th class="text-right">Total Revenue</th>
            <th class="text-right">Sales Share</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

  } else if (type === "slow_movers") {
    reportTitle = "Slow Moving Inventory Report";

    // Build Product sales map
    const productSalesMap: Record<string, number> = {};
    for (const item of orderItems) {
      productSalesMap[item.name] = (productSalesMap[item.name] || 0) + (item.quantity || 0);
    }

    // List all products and match their sales count
    const slowMovers = products.map(p => {
      const unitsSold = productSalesMap[p.name] || 0;
      const revenue = unitsSold * (p.price || 0);
      return {
        name: p.name,
        sku: p.sku || "N/A",
        stockCount: p.stockCount || 0,
        price: p.price || 0,
        unitsSold,
        revenue
      };
    }).sort((a, b) => a.unitsSold - b.unitsSold);

    const zeroSalesCount = slowMovers.filter(p => p.unitsSold === 0).length;

    // KPI Cards
    kpiCardsHtml = `
      <div class="kpi-card error-border">
        <div class="kpi-label">Zero Sales Items</div>
        <div class="kpi-value text-error">${zeroSalesCount} items</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Stagnant Stock Value</div>
        <div class="kpi-value">Rs. ${slowMovers.reduce((acc, p) => acc + (p.stockCount * p.price), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Catalog Products</div>
        <div class="kpi-value">${products.length}</div>
      </div>
    `;

    // Table
    let rowsHtml = slowMovers.length > 0
      ? slowMovers.map((p, idx) => `
          <tr>
            <td><span class="badge gray">${idx + 1}</span></td>
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td>${escapeHtml(p.sku)}</td>
            <td class="text-right bold ${p.stockCount <= 5 ? "text-error" : ""}">${p.stockCount}</td>
            <td class="text-right">${p.unitsSold}</td>
            <td class="text-right">Rs. ${p.price.toFixed(2)}</td>
            <td class="text-right">Rs. ${p.revenue.toFixed(2)}</td>
            <td><span class="status-indicator ${p.unitsSold === 0 ? "inactive" : "warning"}">${p.unitsSold === 0 ? "Stagnant" : "Slow"}</span></td>
          </tr>
        `).join("")
      : `<tr><td colspan="8" class="text-center">No inventory products defined in the database.</td></tr>`;

    contentHtml = `
      <h3>Stagnant Inventory & Sales Performance</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 50px;">Index</th>
            <th>Product Name</th>
            <th>SKU</th>
            <th class="text-right">Current Stock</th>
            <th class="text-right">Units Sold</th>
            <th class="text-right">Unit Price</th>
            <th class="text-right">Generated Sales</th>
            <th>Movement Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

  } else if (type === "orders_ledger") {
    reportTitle = "Store Orders Ledger Report";

    // KPI Cards
    kpiCardsHtml = `
      <div class="kpi-card">
        <div class="kpi-label">Gross Sales Revenue</div>
        <div class="kpi-value text-success">Rs. ${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Invoices</div>
        <div class="kpi-value">${totalOrdersCount}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Average Order Basket</div>
        <div class="kpi-value">Rs. ${avgBasket.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>
    `;

    // Map order items to orders
    const itemsByOrder: Record<string, string[]> = {};
    for (const item of orderItems) {
      const orderId = item._raw?.order_id || item.orderId;
      if (orderId) {
        if (!itemsByOrder[orderId]) itemsByOrder[orderId] = [];
        itemsByOrder[orderId].push(`${item.quantity}x ${item.name}`);
      }
    }

    const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    let rowsHtml = sortedOrders.length > 0
      ? sortedOrders.map(o => {
          const date = new Date(o.createdAt).toLocaleString();
          // Extract cashier from invoice number or default
          const cashierLabel = o.invoiceNumber && o.invoiceNumber.includes("Staff:") 
            ? o.invoiceNumber.split("Staff:")[1]?.split("|")[0]?.replace(")", "")?.trim() || "Cashier"
            : "Cashier";
          const itemsDesc = itemsByOrder[o.id] ? itemsByOrder[o.id].join(", ") : "—";

          return `
            <tr>
              <td><strong>#${escapeHtml(o.invoiceNumber?.split(" ")[0] || o.id.slice(-6).toUpperCase())}</strong></td>
              <td>${date}</td>
              <td>${escapeHtml(cashierLabel)}</td>
              <td><span class="status-indicator active">${escapeHtml(o.status || "Paid")}</span></td>
              <td><div class="compact-text">${escapeHtml(itemsDesc)}</div></td>
              <td class="text-right bold">Rs. ${(o.totalAmount || 0).toFixed(2)}</td>
            </tr>
          `;
        }).join("")
      : `<tr><td colspan="6" class="text-center">No orders recorded in the database.</td></tr>`;

    contentHtml = `
      <h3>Invoices Registry</h3>
      <table>
        <thead>
          <tr>
            <th>Invoice Num</th>
            <th>Date & Time</th>
            <th>Processed By</th>
            <th>Status</th>
            <th style="width: 300px;">Items Summary</th>
            <th class="text-right">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

  } else if (type === "item_sales") {
    reportTitle = "Item-Wise Sales Summary";

    // Aggregate statistics per product SKU
    const itemSales: Record<string, { sku: string; stock: number; ordersCount: number; unitsSold: number; price: number; revenue: number }> = {};
    
    // Initialize map with all database products
    for (const p of products) {
      itemSales[p.name] = {
        sku: p.sku || "N/A",
        stock: p.stockCount || 0,
        ordersCount: 0,
        unitsSold: 0,
        price: p.price || 0,
        revenue: 0
      };
    }

    // Populate using orderItems
    for (const item of orderItems) {
      const name = item.name || "Unknown Item";
      if (!itemSales[name]) {
        itemSales[name] = { sku: item.sku || "N/A", stock: 0, ordersCount: 0, unitsSold: 0, price: item.price || 0, revenue: 0 };
      }
      itemSales[name].unitsSold += item.quantity || 0;
      itemSales[name].revenue += (item.quantity || 0) * (item.price || 0);
      itemSales[name].ordersCount += 1;
    }

    const itemsList = Object.keys(itemSales)
      .map(name => ({ name, ...itemSales[name] }))
      .sort((a, b) => b.revenue - a.revenue);

    // KPI Cards
    kpiCardsHtml = `
      <div class="kpi-card">
        <div class="kpi-label">Products Catalogue Size</div>
        <div class="kpi-value">${products.length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Active Selling Items</div>
        <div class="kpi-value">${itemsList.filter(i => i.unitsSold > 0).length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Highest Revenue Product</div>
        <div class="kpi-value">Rs. ${(itemsList[0]?.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>
    `;

    // Table
    let rowsHtml = itemsList.length > 0
      ? itemsList.map((item, idx) => `
          <tr>
            <td><strong>${escapeHtml(item.name)}</strong></td>
            <td>${escapeHtml(item.sku)}</td>
            <td class="text-right bold ${item.stock <= 5 ? "text-error" : ""}">${item.stock}</td>
            <td class="text-right">${item.ordersCount} times</td>
            <td class="text-right">${item.unitsSold} units</td>
            <td class="text-right">Rs. ${item.price.toFixed(2)}</td>
            <td class="text-right bold">Rs. ${item.revenue.toFixed(2)}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="7" class="text-center">No catalog items defined.</td></tr>`;

    contentHtml = `
      <h3>Catalog Sales Metrics</h3>
      <table>
        <thead>
          <tr>
            <th>Product Name</th>
            <th>SKU</th>
            <th class="text-right">Current Stock</th>
            <th class="text-right">Orders Count</th>
            <th class="text-right">Total Units Sold</th>
            <th class="text-right">Standard Price</th>
            <th class="text-right">Total Sales Revenue</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

  } else if (type === "branch_performance") {
    reportTitle = "Branch Performance & Low Stock Audit";

    // Staff / Cashier sales calculations
    const staffSales: Record<string, { count: number; total: number }> = {};
    for (const order of orders) {
      const invoice = order.invoiceNumber || "";
      let cashier = "Owner / Admin";
      if (invoice.includes("Staff:")) {
        cashier = invoice.split("Staff:")[1]?.split("|")[0]?.replace(")", "")?.trim() || "Owner / Admin";
      }
      if (!staffSales[cashier]) staffSales[cashier] = { count: 0, total: 0 };
      staffSales[cashier].count += 1;
      staffSales[cashier].total += order.totalAmount || 0;
    }

    const sortedStaff = Object.keys(staffSales)
      .map(name => ({ name, ...staffSales[name] }))
      .sort((a, b) => b.total - a.total);

    // Filter low stock items
    const lowStockProducts = products.filter(p => {
      const stock = p.stockCount ?? 0;
      const alertLimit = p.lowStockAlert ?? 5;
      return stock <= alertLimit;
    });

    // KPI Cards
    kpiCardsHtml = `
      <div class="kpi-card">
        <div class="kpi-label">Gross Sales</div>
        <div class="kpi-value">Rs. ${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-card ${lowStockProducts.length > 0 ? "error-border" : ""}">
        <div class="kpi-label">Critical Stock Alerts</div>
        <div class="kpi-value ${lowStockProducts.length > 0 ? "text-error" : ""}">${lowStockProducts.length} items</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Staff Registry Count</div>
        <div class="kpi-value">${sortedStaff.length}</div>
      </div>
    `;

    // Staff Table
    let staffRows = sortedStaff.length > 0
      ? sortedStaff.map((staff, idx) => `
          <tr>
            <td><span class="badge gold">${idx + 1}</span></td>
            <td><strong>${escapeHtml(staff.name)}</strong></td>
            <td class="text-right">${staff.count} checkouts</td>
            <td class="text-right bold">Rs. ${staff.total.toFixed(2)}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="4" class="text-center">No processed cashier orders in record.</td></tr>`;

    // Low stock Table
    let lowStockRows = lowStockProducts.length > 0
      ? lowStockProducts.map(p => `
          <tr>
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td>${escapeHtml(p.sku || "N/A")}</td>
            <td class="text-right text-error bold">${p.stockCount || 0} left</td>
            <td class="text-right">${p.lowStockAlert ?? 5} units</td>
            <td><span class="status-indicator error">Restock Required</span></td>
          </tr>
        `).join("")
      : `<tr><td colspan="5" class="text-center" style="color: #10B981; font-weight: bold;">✓ All store products are fully stocked!</td></tr>`;

    contentHtml = `
      <div class="row">
        <div class="col" style="flex: 1.2; margin-right: 20px;">
          <h3>Cashier Sales Contributions</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">Rank</th>
                <th>Staff Member</th>
                <th class="text-right">Invoices</th>
                <th class="text-right">Checkout Sales</th>
              </tr>
            </thead>
            <tbody>
              ${staffRows}
            </tbody>
          </table>
        </div>
        <div class="col" style="flex: 1.5;">
          <h3>Critical Inventory Alerts</h3>
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>SKU</th>
                <th class="text-right">Quantity</th>
                <th class="text-right">Alert Threshold</th>
                <th>Alert Action</th>
              </tr>
            </thead>
            <tbody>
              ${lowStockRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Complete HTML template
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${reportTitle}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
          
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          body {
            font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
            color: #1e293b;
            background-color: #ffffff;
            padding: 40px;
            font-size: 13px;
            line-height: 1.5;
          }

          header {
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 20px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }

          .biz-info h1 {
            font-size: 26px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.5px;
          }

          .biz-info p {
            font-size: 12px;
            color: #64748b;
            margin-top: 4px;
            font-weight: 500;
          }

          .report-info {
            text-align: right;
          }

          .report-info h2 {
            font-size: 15px;
            font-weight: 700;
            color: #4f46e5;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }

          .report-info p {
            font-size: 11px;
            color: #64748b;
            font-weight: 500;
          }

          /* KPI summary cards row */
          .kpis-row {
            display: flex;
            gap: 16px;
            margin-bottom: 30px;
          }

          .kpi-card {
            flex: 1;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          }

          .kpi-card.error-border {
            border-color: #fecdd3;
            background-color: #fff5f5;
          }

          .kpi-label {
            font-size: 11px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
          }

          .kpi-value {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
          }

          .text-success { color: #10b981; }
          .text-error { color: #ef4444; }

          /* Layout structure */
          .row {
            display: flex;
            width: 100%;
          }

          .col {
            display: flex;
            flex-direction: column;
          }

          h3 {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 12px;
            letter-spacing: -0.2px;
          }

          /* Premium reports table styling */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }

          th {
            background-color: #0f172a;
            color: #ffffff;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            text-align: left;
            padding: 12px 14px;
          }

          th:first-child {
            border-top-left-radius: 8px;
            border-bottom-left-radius: 8px;
          }

          th:last-child {
            border-top-right-radius: 8px;
            border-bottom-right-radius: 8px;
          }

          td {
            padding: 12px 14px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 12px;
            color: #334155;
            vertical-align: middle;
          }

          tr:hover td {
            background-color: #f8fafc;
          }

          .text-right {
            text-align: right;
          }

          .text-center {
            text-align: center;
          }

          .bold {
            font-weight: 700;
          }

          /* Badges */
          .badge {
            display: inline-flex;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 800;
            color: #ffffff;
          }

          .badge.gold { background-color: #fbbf24; }
          .badge.silver { background-color: #9ca3af; }
          .badge.bronze { background-color: #f59e0b; }
          .badge.gray { background-color: #cbd5e1; color: #475569; }

          /* Status Pill Indicators */
          .status-indicator {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .status-indicator.active {
            background-color: #d1fae5;
            color: #065f46;
          }

          .status-indicator.warning {
            background-color: #fef3c7;
            color: #92400e;
          }

          .status-indicator.inactive {
            background-color: #f3f4f6;
            color: #4b5563;
          }

          .status-indicator.error {
            background-color: #fee2e2;
            color: #991b1b;
          }

          .compact-text {
            font-size: 11px;
            color: #64748b;
            max-width: 320px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          footer {
            border-top: 1px solid #e2e8f0;
            padding-top: 16px;
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #94a3b8;
            font-weight: 500;
          }

          .footer-logo {
            font-weight: 700;
            color: #4f46e5;
          }

          @media print {
            body {
              padding: 0;
            }
            .kpi-card {
              background-color: #f8fafc !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            th {
              background-color: #0f172a !important;
              color: #ffffff !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .badge {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .badge.gold { background-color: #fbbf24 !important; }
            .badge.silver { background-color: #9ca3af !important; }
            .badge.bronze { background-color: #f59e0b !important; }
            .badge.gray { background-color: #cbd5e1 !important; }
            .status-indicator.active { background-color: #d1fae5 !important; color: #065f46 !important; }
            .status-indicator.warning { background-color: #fef3c7 !important; color: #92400e !important; }
            .status-indicator.inactive { background-color: #f3f4f6 !important; color: #4b5563 !important; }
            .status-indicator.error { background-color: #fee2e2 !important; color: #991b1b !important; }
          }
        </style>
      </head>
      <body>
        <header>
          <div class="biz-info">
            <h1>${businessName}</h1>
            <p>${businessCategory} | ${businessAddress} | Tel: ${businessPhone}</p>
          </div>
          <div class="report-info">
            <h2>${escapeHtml(reportTitle)}</h2>
            <p>Database Scope: All-Time History</p>
            <p>Generated: ${escapeHtml(generatedDate)}</p>
          </div>
        </header>

        <section class="kpis-row">
          ${kpiCardsHtml}
        </section>

        <main>
          ${contentHtml}
        </main>

        <footer>
          <div>Report generated in branch system database registry.</div>
          <div><span class="footer-logo">Shopbook POS</span> Ledger statements</div>
        </footer>
      </body>
    </html>
  `;
}

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return "";
  let s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildReportCsv(type: ReportType, data: ReportData): string {
  const { business, orders, orderItems, products } = data;
  const businessName = business.name;
  const generatedDate = new Date().toLocaleString();

  const totalSales = orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  const totalOrdersCount = orders.length;
  const avgBasket = totalOrdersCount > 0 ? totalSales / totalOrdersCount : 0;

  let csvContent = "";

  if (type === "best_sellers") {
    // Header Info
    csvContent += `STORE BUSINESS REPORT,Best Selling Products\n`;
    csvContent += `Store Name,${escapeCsv(businessName)}\n`;
    csvContent += `Generated Date,${escapeCsv(generatedDate)}\n`;
    csvContent += `Scope,All-Time Database History\n\n`;

    // Process best sellers
    const productSales: Record<string, { sku: string; category: string; quantity: number; revenue: number; price: number }> = {};
    for (const item of orderItems) {
      const name = item.name || "Unknown Item";
      if (!productSales[name]) {
        productSales[name] = { sku: item.sku || "N/A", category: item.category || "General", quantity: 0, revenue: 0, price: item.price || 0 };
      }
      productSales[name].quantity += item.quantity || 0;
      productSales[name].revenue += (item.quantity || 0) * (item.price || 0);
    }

    const sortedBest = Object.keys(productSales)
      .map(name => ({ name, ...productSales[name] }))
      .sort((a, b) => b.quantity - a.quantity);

    // KPI row
    csvContent += `KPI,Unique Products Sold,Total Units Sold,Top Product Revenue\n`;
    const totalUnitsSold = sortedBest.reduce((acc, p) => acc + p.quantity, 0);
    csvContent += `Summary,${sortedBest.length},${totalUnitsSold},Rs. ${(sortedBest[0]?.revenue || 0).toFixed(2)}\n\n`;

    // Table Data
    csvContent += `Rank,Product Name,SKU,Category,Units Sold,Unit Price (Rs.),Total Revenue (Rs.),Sales Share\n`;
    sortedBest.forEach((p, idx) => {
      const share = totalSales > 0 ? (p.revenue / totalSales) * 100 : 0;
      csvContent += `${idx + 1},${escapeCsv(p.name)},${escapeCsv(p.sku)},${escapeCsv(p.category)},${p.quantity},${p.price.toFixed(2)},${p.revenue.toFixed(2)},${share.toFixed(1)}%\n`;
    });

  } else if (type === "slow_movers") {
    csvContent += `STORE BUSINESS REPORT,Slow Moving Inventory\n`;
    csvContent += `Store Name,${escapeCsv(businessName)}\n`;
    csvContent += `Generated Date,${escapeCsv(generatedDate)}\n`;
    csvContent += `Scope,All-Time Database History\n\n`;

    const productSalesMap: Record<string, number> = {};
    for (const item of orderItems) {
      productSalesMap[item.name] = (productSalesMap[item.name] || 0) + (item.quantity || 0);
    }

    const slowMovers = products.map(p => {
      const unitsSold = productSalesMap[p.name] || 0;
      const revenue = unitsSold * (p.price || 0);
      return {
        name: p.name,
        sku: p.sku || "N/A",
        stockCount: p.stockCount || 0,
        price: p.price || 0,
        unitsSold,
        revenue
      };
    }).sort((a, b) => a.unitsSold - b.unitsSold);

    const zeroSalesCount = slowMovers.filter(p => p.unitsSold === 0).length;
    const totalStockVal = slowMovers.reduce((acc, p) => acc + (p.stockCount * p.price), 0);

    // KPI row
    csvContent += `KPI,Zero Sales Items,Stagnant Stock Value (Rs.),Catalog size\n`;
    csvContent += `Summary,${zeroSalesCount},${totalStockVal.toFixed(2)},${products.length}\n\n`;

    // Table Data
    csvContent += `Index,Product Name,SKU,Current Stock,Units Sold,Unit Price (Rs.),Generated Sales (Rs.),Movement Status\n`;
    slowMovers.forEach((p, idx) => {
      csvContent += `${idx + 1},${escapeCsv(p.name)},${escapeCsv(p.sku)},${p.stockCount},${p.unitsSold},${p.price.toFixed(2)},${p.revenue.toFixed(2)},${p.unitsSold === 0 ? "Stagnant" : "Slow"}\n`;
    });

  } else if (type === "orders_ledger") {
    csvContent += `STORE BUSINESS REPORT,Store Orders Ledger\n`;
    csvContent += `Store Name,${escapeCsv(businessName)}\n`;
    csvContent += `Generated Date,${escapeCsv(generatedDate)}\n`;
    csvContent += `Scope,All-Time Database History\n\n`;

    // KPI row
    csvContent += `KPI,Gross Sales Revenue (Rs.),Total Invoices,Average Order Value (Rs.)\n`;
    csvContent += `Summary,${totalSales.toFixed(2)},${totalOrdersCount},${avgBasket.toFixed(2)}\n\n`;

    // Map order items to orders
    const itemsByOrder: Record<string, string[]> = {};
    for (const item of orderItems) {
      const orderId = item._raw?.order_id || item.orderId;
      if (orderId) {
        if (!itemsByOrder[orderId]) itemsByOrder[orderId] = [];
        itemsByOrder[orderId].push(`${item.quantity}x ${item.name}`);
      }
    }

    const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Table Data
    csvContent += `Invoice Number,Date & Time,Processed By,Status,Items Summary,Total Amount (Rs.)\n`;
    sortedOrders.forEach(o => {
      const date = new Date(o.createdAt).toLocaleString();
      const cashierLabel = o.invoiceNumber && o.invoiceNumber.includes("Staff:") 
        ? o.invoiceNumber.split("Staff:")[1]?.split("|")[0]?.replace(")", "")?.trim() || "Cashier"
        : "Cashier";
      const itemsDesc = itemsByOrder[o.id] ? itemsByOrder[o.id].join(", ") : "—";
      csvContent += `#${escapeCsv(o.invoiceNumber?.split(" ")[0] || o.id.slice(-6).toUpperCase())},${escapeCsv(date)},${escapeCsv(cashierLabel)},${escapeCsv(o.status || "Paid")},${escapeCsv(itemsDesc)},${(o.totalAmount || 0).toFixed(2)}\n`;
    });

  } else if (type === "item_sales") {
    csvContent += `STORE BUSINESS REPORT,Item-Wise Sales Summary\n`;
    csvContent += `Store Name,${escapeCsv(businessName)}\n`;
    csvContent += `Generated Date,${escapeCsv(generatedDate)}\n`;
    csvContent += `Scope,All-Time Database History\n\n`;

    const itemSales: Record<string, { sku: string; stock: number; ordersCount: number; unitsSold: number; price: number; revenue: number }> = {};
    for (const p of products) {
      itemSales[p.name] = { sku: p.sku || "N/A", stock: p.stockCount || 0, ordersCount: 0, unitsSold: 0, price: p.price || 0, revenue: 0 };
    }
    for (const item of orderItems) {
      const name = item.name || "Unknown Item";
      if (!itemSales[name]) {
        itemSales[name] = { sku: item.sku || "N/A", stock: 0, ordersCount: 0, unitsSold: 0, price: item.price || 0, revenue: 0 };
      }
      itemSales[name].unitsSold += item.quantity || 0;
      itemSales[name].revenue += (item.quantity || 0) * (item.price || 0);
      itemSales[name].ordersCount += 1;
    }

    const itemsList = Object.keys(itemSales)
      .map(name => ({ name, ...itemSales[name] }))
      .sort((a, b) => b.revenue - a.revenue);

    csvContent += `KPI,Products Catalogue Size,Active Selling Items,Highest Revenue (Rs.)\n`;
    csvContent += `Summary,${products.length},${itemsList.filter(i => i.unitsSold > 0).length},${(itemsList[0]?.revenue || 0).toFixed(2)}\n\n`;

    // Table Data
    csvContent += `Product Name,SKU,Current Stock,Orders Count,Total Units Sold,Standard Price (Rs.),Total Sales Revenue (Rs.)\n`;
    itemsList.forEach(item => {
      csvContent += `${escapeCsv(item.name)},${escapeCsv(item.sku)},${item.stock},${item.ordersCount},${item.unitsSold},${item.price.toFixed(2)},${item.revenue.toFixed(2)}\n`;
    });

  } else if (type === "branch_performance") {
    csvContent += `STORE BUSINESS REPORT,Branch Performance & Low Stock Audit\n`;
    csvContent += `Store Name,${escapeCsv(businessName)}\n`;
    csvContent += `Generated Date,${escapeCsv(generatedDate)}\n`;
    csvContent += `Scope,All-Time Database History\n\n`;

    // Staff calculations
    const staffSales: Record<string, { count: number; total: number }> = {};
    for (const order of orders) {
      const invoice = order.invoiceNumber || "";
      let cashier = "Owner / Admin";
      if (invoice.includes("Staff:")) {
        cashier = invoice.split("Staff:")[1]?.split("|")[0]?.replace(")", "")?.trim() || "Owner / Admin";
      }
      if (!staffSales[cashier]) staffSales[cashier] = { count: 0, total: 0 };
      staffSales[cashier].count += 1;
      staffSales[cashier].total += order.totalAmount || 0;
    }
    const sortedStaff = Object.keys(staffSales)
      .map(name => ({ name, ...staffSales[name] }))
      .sort((a, b) => b.total - a.total);

    // Filter low stock
    const lowStockProducts = products.filter(p => {
      const stock = p.stockCount ?? 0;
      const alertLimit = p.lowStockAlert ?? 5;
      return stock <= alertLimit;
    });

    csvContent += `KPI,Gross Sales Revenue (Rs.),Critical Stock Alerts,Staff Registry Count\n`;
    csvContent += `Summary,${totalSales.toFixed(2)},${lowStockProducts.length},${sortedStaff.length}\n\n`;

    csvContent += `CASHIER SALES CONTRIBUTIONS\n`;
    csvContent += `Rank,Staff Member,Invoices Checkout,Sales Total (Rs.)\n`;
    sortedStaff.forEach((staff, idx) => {
      csvContent += `${idx + 1},${escapeCsv(staff.name)},${staff.count},${staff.total.toFixed(2)}\n`;
    });

    csvContent += `\nCRITICAL INVENTORY ALERTS\n`;
    csvContent += `Item Name,SKU,Current Stock,Alert Threshold,Alert Action\n`;
    lowStockProducts.forEach(p => {
      csvContent += `${escapeCsv(p.name)},${escapeCsv(p.sku || "N/A")},${p.stockCount || 0},${p.lowStockAlert ?? 5},Restock Required\n`;
    });
  }

  return csvContent;
}
