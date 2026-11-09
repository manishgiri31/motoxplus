package com.motoxplus.api.delhivery;

/**
 * Everything about Delhivery's "Create & Update Warehouse" API that must come from the Delhivery portal's own curl
 * (One portal, API docs), and nowhere else. Nothing here is guessed: until all three are filled in from that curl,
 * {@link #complete()} is false and {@link DelhiveryClient#createWarehouse} sends nothing.
 *
 * <p>To finish the integration: copy the portal's curl for "Create & Update Warehouse", then set
 * <ul>
 *   <li>{@code app.delhivery.warehouse.create-path}: the path from the curl, e.g. what follows the host;</li>
 *   <li>{@code app.delhivery.warehouse.exists-error}: the EXACT text Delhivery answers when the name already exists
 *       (capture it by sending the same name twice);</li>
 *   <li>{@code app.delhivery.warehouse.name-max-length}: the name length limit the portal states;</li>
 * </ul>
 * and check {@link DelhiveryClient#warehousePayload} field by field against the curl's body.
 *
 * @param createPath  path of the create call, starting with "/"
 * @param existsError exact substring of Delhivery's "name already exists" answer
 * @param nameMaxLength longest warehouse name Delhivery accepts
 */
public record DelhiveryWarehouseSpec(String createPath, String existsError, int nameMaxLength) {
    /** Placeholder for every value not yet copied from the portal curl. */
    public static final String TODO = "TODO_FROM_PORTAL_CURL";
    /** The create path, as it stands until the portal curl is pasted in. */
    public static final String WAREHOUSE_CREATE_PATH = TODO;

    public static final DelhiveryWarehouseSpec UNCONFIGURED = new DelhiveryWarehouseSpec(WAREHOUSE_CREATE_PATH, TODO, 0);

    public DelhiveryWarehouseSpec {
        createPath = createPath == null ? TODO : createPath.trim();
        existsError = existsError == null ? TODO : existsError.trim();
    }

    public boolean complete() {
        return !createPath.contains(TODO) && createPath.startsWith("/")
                && !existsError.contains(TODO) && !existsError.isEmpty()
                && nameMaxLength > 0;
    }

    /** What is still missing, for logs and the vendor-facing error. Empty when {@link #complete()}. */
    public String missing() {
        StringBuilder s = new StringBuilder();
        if (createPath.contains(TODO) || !createPath.startsWith("/")) s.append("create path, ");
        if (existsError.contains(TODO) || existsError.isEmpty()) s.append("exists error text, ");
        if (nameMaxLength <= 0) s.append("name length limit, ");
        return s.isEmpty() ? "" : s.substring(0, s.length() - 2);
    }
}
