Compacted conversationI'll navigate through each module of the ConCoveCMS application to show you all available functionalities. Let me go through them systematically: 

Read [Browser](vscode-browser:/b3cdda9f-19d5-4dda-b417-e2b30f5b5bb7?vscodeLinkType=browser)

Clicked Materials link in [Browser](vscode-browser:/b3cdda9f-19d5-4dda-b417-e2b30f5b5bb7?vscodeLinkType=browser)

Navigated to http://localhost:5173/materials in [Browser](vscode-browser:/b3cdda9f-19d5-4dda-b417-e2b30f5b5bb7?vscodeLinkType=browser)

Let me read through the source code to document all functionalities available in each module:   

Read [](file:///c%3A/Users/abhis/OneDrive/Documents/ConCoveCMS/src/pages/MaterialsPage.tsx#1-1), lines 1 to 150

Read [](file:///c%3A/Users/abhis/OneDrive/Documents/ConCoveCMS/src/pages/Dashboard.tsx#1-1), lines 1 to 150

Read [](file:///c%3A/Users/abhis/OneDrive/Documents/ConCoveCMS/src/pages/OperationsPage.tsx#1-1), lines 1 to 100

Read [](file:///c%3A/Users/abhis/OneDrive/Documents/ConCoveCMS/src/pages/SyncMonitorPage.tsx#1-1), lines 1 to 100

Read [](file:///c%3A/Users/abhis/OneDrive/Documents/ConCoveCMS/src/pages/EntitiesPage.tsx)

Now let me check the README to get additional context about the system: 

Read [](file:///c%3A/Users/abhis/OneDrive/Documents/ConCoveCMS/README.md)

Based on my review of the ConCoveCMS codebase, here's a complete breakdown of **all functionalities** available to end users managing construction inventory:

---

## **1. 📊 DASHBOARD — Global Inventory Overview**

**Purpose:** God-view of inventory health across all 25+ construction sites

**Functionalities:**
- **Site Selection Dropdown** - Switch between construction sites to view site-specific inventory
- **Inventory Heatmap Grid** - Matrix view showing:
  - Each material in rows (up to 12 displayed)
  - Each site in columns
  - Color-coded health scores:
    - 🔴 **Red** (< 30): Critical stockout risk
    - 🟠 **Amber** (30-60): Low stock warning  
    - 🟢 **Green** (> 60): Healthy inventory
- **Critical Alerts Section** - Displays top 8 materials with lowest risk scores across all sites:
  - Material code name
  - Calculated "stockout risk index" for each
  - Alerts for anything under 30% threshold
- **Tenant Information Display** - Shows current project (Badri Rai Construction) and tenant scope

---

## **2. 📦 MATERIALS — Material Catalog Management**

**Purpose:** Central repository for approved construction materials with standardized unit conversions

**Functionalities:**
- **Create Material Draft Form** with fields:
  - 📝 **Material Code** - Input field with **automatic kebab-case normalization** (e.g., "Galvanized Steel 16mm" → "galvanized-steel-16mm")
  - **Live Code Normalizer Preview** - Real-time visual feedback showing normalized code transformation
  - 📄 **Description** - Material specifications (e.g., "Reinforcement steel bar")
  - 📊 **Base UoM** (Unit of Measure) - Base inventory unit (LITER, KG, BAG, TON, PIECE, METER)
  - 📊 **Issue UoM** - Unit used when dispensing/issuing material
  - 🔄 **Conversion Factor** - Ratio between base and issue units
  - ✅ **Submit Button** - Creates draft for batch processing

- **Materials List Display**
  - Shows all existing materials from catalog
  - Displays: Code, Description, Base UoM, Issue UoM, Conversion Factor
  - Scrollable/paginated view

- **Stored Drafts Section**
  - Temporary local drafts created in current session
  - Can be reviewed before batch submit to backend

- **Error Handling**
  - Displays friendly error messages if material load fails
  - Shows tenant configuration status

---

## **3. 🏗️ ENTITIES — Organizational Structure**

**Purpose:** Manage all parties involved in the construction supply chain

**Functionalities:**

Organized into 4 entity types (each in separate card with count badge):

1. **INTERNAL_SITE** 🏢
   - Construction project sites (main work locations)
   - Each site has ID, name, and metadata
   - Used for inventory location tracking

2. **VENDOR** 🚚
   - Suppliers who provide materials
   - Used in purchase order and inbound transactions

3. **SUBCONTRACTOR** 👷
   - External teams/organizations working on project
   - Used for material transfer tracking

4. **EMPLOYEE** 👤
   - Project staff managing inventory and logistics
   - Audit trail reference for transactions

**Each entity shows:**
- Name and UUID identifier
- Scrollable list with count indicator
- "No records found" message if category is empty

---

## **4. ⚙️ OPERATIONS — Transaction Management & Procurement**

**Purpose:** Core workspace for inventory transactions, purchase orders, and batch processing

**Three-Section Interface:**

### **Section A: Procurement Module** 📋
Create and track purchase orders with integrated progress visualization

**Purchase Order Creation:**
- **PO Number** - Unique identifier for the purchase order
- **Status Dropdown** - Track PO lifecycle:
  - DRAFT → APPROVED → PARTIALLY_FULFILLED → COMPLETED
  - **PO Progress Tracker Component** displays visual 4-stage timeline showing current status
  - Real-time updates as status changes
- **Vendor Selection** - Dropdown to select supplier
- **Procurement Lines** - Multiple line items per PO:
  - Material selection
  - Quantity field
  - UoM selection
- **Submit Button** - Create PO in system

### **Section B: Ledger Adjustment Module** 📝
Handle corrective transactions using immutable ledger pattern

**Transaction Creation:**
- **Transaction Type Selection:**
  - INWARD - Receiving materials
  - OUTWARD - Issuing materials
  - IST_DISPATCH - Inter-site transfer (from site)
  - IST_RECEIPT - Inter-site transfer (to site)
- **Material Selection** - Pick from material catalog
- **Quantity Input** - Amount to transact
- **Site Selection** - Which site is involved
- **Related Entity** - Vendor/Subcontractor involved

**Correction Mode:**
- Load previous transactions from sync history
- Create compensating transaction (auto-reverses: INWARD↔OUTWARD, IST_DISPATCH↔IST_RECEIPT)
- Document correction reason
- Tracks parent transaction via `correction_of_transaction_id`

### **Section C: Batch Sync Interface** 🔄
Submit transactions to backend with multi-status handling

**Batch Operations:**
- **Batch Submit Button** - Send collected transactions to backend
- **Sync Response Parsing** - Handles HTTP 207 Multi-Status responses:
  - ✅ Individual transaction success/failure feedback
  - Failed items stored in local queue
- **Operation Notice** - Feedback messages (success/warning/info) with color coding
- **Client Transaction IDs** - Auto-generated UUID for tracking (via crypto.randomUUID)

---

## **5. 🔍 SYNC MONITOR — Failed Record Management & Retry Workflow**

**Purpose:** Monitor, debug, and correct inventory sync failures with full audit trail

**Functionalities:**

### **Failed Records Queue**
- Shows all transactions that failed to sync with backend
- For each failed record:
  - **Failure Category Badges** - Auto-classified as:
    - 🟠 Tenant Mismatch - Site/entity tenant conflict
    - 🔵 Validation - Required field or data format issues
    - ⚫ Sync Failure - Other backend errors
  - **Error Message** - Full error text from backend
  - **Recorded Timestamp** - When failure occurred (formatted as DD MMM YYYY HH:MM)
  - **Retry Button** - Resubmit to backend
  - **Correction Button** - Create compensating transaction

### **Successful Transactions History**
- Immutable ledger of all successful syncs
- Indexed by `client_transaction_id`
- Shows correction chains

### **Search & Filter**
- **Search Box** - Filter by material code, error message, or transaction ID
- **Correction Filter Chips** (3 modes):
  - **ALL** - Show all successful transactions
  - **ORIGINAL** - Show only root transactions (no corrections)
  - **CORRECTION** - Show only corrective entries
  - Filter shows correction hierarchy with parent-child relationships
  - Expandable/collapsible groups

### **Summary Counters**
- Total failed records count
- Total successful records count
- Correction chain depth

### **Data Maintenance**
- **Clear Data Button** - Remove all sync history & failed records for current tenant
- localStorage-backed persistence (max 100 failed records per tenant)

---

## **6. 🌐 Multi-Tenant Awareness**

All modules support:
- **Tenant Selector** - Switch between different construction projects
- **Tenant-Scoped Data** - Each operation isolated to selected project
- **X-Tenant-ID Header** - Automatically added to all API calls
- **Tenant Display** - Shows current tenant name and UUID

---

## **7. 🎯 Special Features**

### **Visual Components**
- **PO Progress Tracker** - Horizontal 4-stage timeline showing purchase order progression (DRAFT → APPROVED → PARTIALLY_FULFILLED → COMPLETED)
- **Material Code Normalizer** - Live preview showing kebab-case transformation as user types

### **Data Handling**
- **Draft System** - Temporary local drafts before backend submission
- **Batch Processing** - Submit multiple transactions at once
- **Local Persistence** - Browser localStorage for offline resilience
- **Immutable Ledger** - Transactions are never edited; corrections create new compensating entries

### **Error Recovery**
- Failed record queue with categorized failures
- One-click retry for failed submissions
- Correction workflow for data integrity
- Tenant mismatch detection and reporting

---

## **8. 📊 Data Types Managed**

The system tracks:
- **Materials** - 6 standard UoMs (LITER, KG, BAG, TON, PIECE, METER)
- **Entities** - Sites, Vendors, Subcontractors, Employees
- **Purchase Orders** - With 4-stage status lifecycle
- **Inventory Transactions** - INWARD/OUTWARD/IST_DISPATCH/IST_RECEIPT
- **Corrections** - Compensating transactions with audit trail

---

## **Summary: Use Cases for Construction Managers**

✅ **Visibility** - Dashboard heatmap for stockout risk across 25+ sites  
✅ **Planning** - Create and track purchase orders through fulfillment stages  
✅ **Recording** - Log material movements (receives, issues, transfers)  
✅ **Corrections** - Issue credits/adjustments for damaged/misplaced materials  
✅ **Debugging** - Investigate sync failures and retry problematic records  
✅ **Auditing** - Full immutable transaction history with correction chains  
✅ **Multi-Project** - Manage inventory across different projects/tenants

This is a **purpose-built construction inventory control system** focused on real-time visibility, reliable transaction recording, and data integrity through immutable ledgers.

