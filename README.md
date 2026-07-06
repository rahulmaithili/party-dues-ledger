# Mr.Rahul ERP - Party Dues Ledger & Billing Software

A modern, high-performance Enterprise Resource Planning (ERP) web application tailored for gas agencies, distributors, and trading businesses. Built on a serverless Google Sheets database with sub-second page loads, real-time synchronization, and fully offline-resilient local caching.

---

## 🚀 Core Features & Modules

### 1. Dynamic Dashboard
* **Net Outstanding Dues Hero Card**: Instantly computes and displays the Net Dues (`Total Receivables - Total Payables`) with visual HSL status indicators.
* **Operational KPI Indicators**: Live cards showing Sales (This Month), Purchases (This Month), Cash in Hand, and Bank Account reserves.
* Low Stock Alert indicators and interactive charts showing Sales vs. Purchases.

### 2. Parties & Directory Management
* Complete table and responsive grid view of Customers and Suppliers.
* **WhatsApp Reminders**: One-click reminder dispatching for overdue balances.
* **Live GPS Location Capture**: Capture and store physical delivery location coordinates.
* **Google Maps Integration**: Direct navigation links open client coordinates in Google Maps instantly.
* **Excel / CSV Bulk Import**: Direct Excel-to-ERP data uploading tool.

### 3. Cylinder & Returnable Security Deposits
* Dedicated portal for tracking returnable cylinders or shells given to clients.
* **Security Deposit Entry**: Record deposit amounts and quantities collected.
* **Refund & Return Logs**: Track cylinder returns with automatic **proportional deposit refund calculations**.

### 4. Products & Stock Inventory
* Manage products, units, purchase/sale prices, HSN, and GST rates.
* **Dynamic Category Selectors**: Dropdown selectors populated from existing items, with a `[+]` button to dynamically create new categories on the fly.

### 5. Sales, Purchases & Invoicing
* Build invoices with dynamic line items, taxes, and cash/bank payment splits.
* **Flat Invoicing Discounts**: Add flat-rupee discounts, which automatically subtract before calculating taxes.
* **Cashier Logging**: Tracks exactly which staff member or cashier entered or updated transactions.

### 6. Interactive Reports Panel
* Premium split-screen layout with a vertical report menu selector.
* Generates: **Day Book**, **Profit & Loss**, **Stock Valuation**, **Account Ledger**, **Outstanding Balances**, **Sales/Purchase Journals**, and **Expense Distribution**.
* Fully print-ready layouts with date presets.

### 7. User Profiles & Custom Themes
* Persistent **Day Mode / Dark Mode** theme switcher.
* Profile settings modal for updating passwords and uploading **custom avatar images**.

---

## 📥 Excel / CSV Data Import Guide

If you have existing party or customer data in Excel, you can upload it directly into the software using either of the two methods below:

### Method 1: Upload via the Web Interface (Recommended)
1. In your Excel file, make sure your columns match the following names (case-insensitive):
   * **Name** (Required) — e.g. `Client name`
   * **Type** — `Customer` or `Supplier` (defaults to Customer)
   * **Mobile** — e.g. `Phone number`
   * **Email** — e.g. `Client email`
   * **Address** — Physical street address
   * **GSTIN** — GST identification number
   * **PAN** — PAN Card number
   * **Opening Balance** — Initial outstanding balance
   * **Credit Limit** — Credit limit allowed (defaults to 50,000)
   * **Payment Terms** — Due terms in days (defaults to 30)
   * **Bank Name** — bank name
   * **Account Number** — bank account number
   * **IFSC** — Bank IFSC code
   * **GPS Location** — Coordinates (e.g. `19.0760, 72.8777`)
2. Save your Excel sheet as a **CSV (Comma Delimited) (*.csv)** file.
3. Open the ERP app, go to the **Parties & Ledgers** tab.
4. Click the **Import CSV / Excel** button in the top right.
5. Select your `.csv` file. The app will parse the rows and upload them in real-time, showing a progress toast!

### Method 2: Copy-Paste Directly in the Google Sheets Database
1. Open your linked Google Sheet database.
2. Go to the sheet named **Parties**.
3. Simply paste your data rows under the corresponding column headers starting from Row 2.
4. The web app will automatically fetch and load the new parties on your next page refresh!

---

## 🛠️ Tech Stack & Architecture

* **Database & API**: Google Apps Script (`Code.js`) acting as a JSON REST API over Google Sheets.
* **Caching & Performance**: Built-in Google `CacheService` caches database reads, serving API calls in **<150ms** with automatic invalidation on POST writes.
* **Frontend**: Vanilla HTML5, CSS3 variables (Light/Dark theme support), and responsive Javascript.
