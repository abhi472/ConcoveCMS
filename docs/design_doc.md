This UI design for **Project ConCove (Badri Rai CMS)** is built to transform the chaotic legacy data and complex backend logic into a high-performance "Command Center."

Based on the `API_CONTRACTS`, `CMS_ARCHITECTURE`, and your screenshots, the design focuses on **Tenant Isolation**, **Immutable Ledger Entries**, and **Operational Clarity**.

---

### 1. The Global Layout (The Shell)
*   **Persistent Sidebar:** 
    *   **Top:** A prominent "Tenant Selector" dropdown (Required by `INTEGRATION_GUIDE`). It displays the active tenant (e.g., *Badri Rai Construction*).
    *   **Navigation:** Dashboard (God View), Material Catalog, Entities (Sites/Vendors), Operations (Procurement & Ledger), and Sync Monitor.
*   **Header:** 
    *   Context-aware Breadcrumbs: `Operations > Ledger Adjustment`.
    *   Status Indicators: Showing live backend connection vs. last sync heartbeat.

---

### 2. Dashboard: The "God View"
Instead of the basic list in your first screenshot, the God View provides cross-site visibility.
*   **Inventory Heatmap:** A grid where rows are Materials and columns are Sites. Cells are color-coded (Red for below `Stock Alert` threshold, Green for OK).
*   **Critical Alerts:** A "Stockout Risk" widget listing materials where `In Stock` < `Alert Level` across the entire tenant.

---

### 3. Workspace: Operations (Ledger Adjustment)
This is the core "Write" UI described in `CMS_ARCHITECTURE`.
*   **Transaction Form:**
    *   **Header:** Auto-generates a `client_transaction_id` (UUID) displayed in small grey text (for technical traceability).
    *   **Entity Selectors:** Polymorphic dropdowns. If `Transaction Type` is **INWARD**, the "Source" dropdown only shows entities filtered by type `VENDOR`.
    *   **Quantity Input:** Strict validation enforcing `quantity > 0`.
    *   **Extension Toggles:** Two "Accordion" sections that are collapsed by default:
        *   **Commercial Details:** Fields for Invoice No, Base Rate, GST Tier (Enum: 5, 12, 18, 28).
        *   **Volumetric Details:** Fields for L, B, H, and Weights.
    *   **Submit Action:** A primary "Commit to Ledger" button with a tenant-aware confirmation dialog: *"Are you sure you want to record this Inward entry for [Site Name]?"*

---

### 4. Workspace: Procurement Superset
A modernized version of your PO screenshot.
*   **PO Stages:** A horizontal progress tracker: `Draft -> Approved -> Partially Fulfilled -> Completed`.
*   **Item Drafting:** A dynamic line-item builder.
    *   As the user types a material name, it searches the `materials` catalog.
    *   Includes a "Normalized Code" preview (e.g., User types "TMT Steel 12mm" -> Preview shows `tmt-steel-12mm`).
*   **Status Management:** Buttons to trigger state transitions (e.g., "Mark as Approved") which update the Ledger.

---

### 5. Sync Status Inspector (HTTP 207 Handler)
When a batch of transactions is pushed, this UI handles the results described in `API_CONTRACTS`.
*   **Result Table:**
    *   **ID:** `client_transaction_id`.
    *   **Status Tag:** Green `SUCCESS` or Red `FAILED`.
    *   **Message:** Direct string from the API (e.g., "material_id is required" or "Tenant mismatch").
    *   **Action:** A "Fix & Retry" button for failed records that re-opens the transaction form with the failing data pre-filled.

---

### 6. Material Catalog Manager
*   **The "Kebab" Enforcer:** When creating a new material, the `material_code` field auto-formats as the user types (Regex: lowercase, replace spaces with hyphens).
*   **UOM Mapping:** A clear UI to define `Base UOM` vs `Issue UOM` and the `Conversion Factor`. (e.g., Buy in TON, Issue in KG).

---

### Visual Style Guide (Tailwind-based)
*   **Colors:**
    *   *Primary:* Deep Industrial Blue (`#1e293b`) for the Sidebar.
    *   *Action:* Construction Orange (`#f59e0b`) for buttons and warnings.
    *   *Surface:* Clean White/Light Grey (`#f8fafc`) to reduce cognitive load during heavy data entry.
*   **Typography:** Monospace fonts for IDs and Quantities to ensure alignment and readability.
*   **Density:** "Medium-High" density. We want to see many rows, but with enough padding to prevent "mis-clicks" on a tablet.

---

### Summary of Design Improvements over Current Screenshots:
1.  **Context Protection:** You cannot edit data for "Project A" while the Sidebar is set to "Tenant B."
2.  **Immutable Logic:** The "Edit" button on transactions is replaced by a "Correction" button which creates a compensating negative/positive entry.
3.  **Normalization:** The material list is no longer a text field but a strict selection from the catalog, preventing the typos seen in your legacy data.
4.  **Error Transparency:** Instead of a generic "Save Failed," the user sees exactly which row in a batch failed validation via the 207 Multi-Status UI.