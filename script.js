const CATEGORIES = [
    "Fresh",
    "RFL",
    "Pran",
    "Ena",
    "Coffee",
    "Chocolate",
    "IceCream"
];

const MAX_HISTORY = 20;


const AppState = {
    currentCategory: "Fresh",
    reportView: "daily",
    store: {},
    historyStack: [],
    deleteTargetIndex: null
};


const editHistoryKeys = new Set();


// ======================================================
// INITIALIZE
// ======================================================

function initApp() {
    setTodayDate();
    loadTheme();
    renderCategoryDropdown();
    loadReportData();
    bindGlobalEvents();
    bindModalHelpers();
    updatePrintHeaderInfo();
}


// ======================================================
// DATE
// ======================================================

function setTodayDate() {
    const dateInput =
        document.getElementById("report-date");

    if (!dateInput) return;

    if (!dateInput.value) {
        const today = new Date();

        const year =
            today.getFullYear();

        const month =
            String(today.getMonth() + 1)
                .padStart(2, "0");

        const day =
            String(today.getDate())
                .padStart(2, "0");

        dateInput.value =
            `${year}-${month}-${day}`;
    }
}


// ======================================================
// STORAGE
// ======================================================

function getStorageKey(dateStr) {
    return `sales_report_${dateStr}`;
}


function saveCurrentState() {

    if (AppState.reportView !== "daily") {
        return;
    }

    const date =
        document.getElementById("report-date")?.value;

    if (!date) return;

    try {

        localStorage.setItem(
            getStorageKey(date),
            JSON.stringify(AppState.store)
        );

    } catch (error) {

        console.error(
            "Could not save report data:",
            error
        );

        alert(
            "Report data could not be saved. Please check browser storage."
        );
    }
}


// ======================================================
// HISTORY / UNDO
// ======================================================

function recordHistory() {

    if (AppState.reportView !== "daily") {
        return;
    }

    AppState.historyStack.push(
        JSON.parse(
            JSON.stringify(AppState.store)
        )
    );

    if (
        AppState.historyStack.length >
        MAX_HISTORY
    ) {

        AppState.historyStack.shift();
    }

    updateActionControlsState();
}


function resetHistory() {

    AppState.historyStack = [];

    editHistoryKeys.clear();
}


function undo() {

    if (
        AppState.reportView !== "daily" ||
        AppState.historyStack.length === 0
    ) {
        return;
    }

    AppState.store =
        AppState.historyStack.pop();

    editHistoryKeys.clear();

    saveCurrentState();

    renderTableRows();

    calculateMetrics();

    updatePrintHeaderInfo();

    updateActionControlsState();
}


// ======================================================
// THEME
// ======================================================

function loadTheme() {

    let savedTheme = null;

    try {

        savedTheme =
            localStorage.getItem("theme");

    } catch (error) {

        console.warn(
            "Could not read theme:",
            error
        );
    }

    document.body.classList.toggle(
        "dark-mode",
        savedTheme !== "light"
    );
}


function toggleTheme() {

    document.body.classList.toggle(
        "dark-mode"
    );

    const isDark =
        document.body.classList.contains(
            "dark-mode"
        );

    try {

        localStorage.setItem(
            "theme",
            isDark ? "dark" : "light"
        );

    } catch (error) {

        console.warn(
            "Could not save theme:",
            error
        );
    }
}


// ======================================================
// CATEGORY
// ======================================================

function renderCategoryDropdown() {

    const select =
        document.getElementById(
            "category-select"
        );

    if (!select) return;

    select.innerHTML = "";

    CATEGORIES.forEach(category => {

        const option =
            document.createElement(
                "option"
            );

        option.value = category;

        option.textContent = category;

        select.appendChild(option);
    });

    select.value =
        AppState.currentCategory;
}


// ======================================================
// LOAD REPORT
// ======================================================

function loadReportData() {

    const date =
        document.getElementById(
            "report-date"
        )?.value;

    if (!date) return;

    resetHistory();

    if (
        AppState.reportView === "daily"
    ) {

        AppState.store =
            getOrInitializeCategoryData(
                date
            );

    } else {

        AppState.store =
            aggregateMonthlyData(
                date
            );
    }

    renderTableRows();

    calculateMetrics();

    updatePrintHeaderInfo();

    updateActionControlsState();
}


// ======================================================
// GET / INITIALIZE CATEGORY DATA
// ======================================================

function getOrInitializeCategoryData(date) {

    const key =
        getStorageKey(date);

    let storedData = {};

    try {

        const saved =
            localStorage.getItem(key);

        if (saved) {
            storedData =
                JSON.parse(saved);
        }

    } catch (error) {

        console.error(
            "Invalid localStorage data:",
            error
        );

        storedData = {};
    }


    const currentCategoryData =
        storedData?.[
            AppState.currentCategory
        ];


    if (
        Array.isArray(
            currentCategoryData
        ) &&
        currentCategoryData.some(
            item =>
                item &&
                typeof item.name === "string" &&
                item.name.trim()
        )
    ) {

        return normalizeStore(
            storedData
        );
    }


    // Find the most recent previous date
    // that contains products.

    const previousDates = [];


    for (
        let i = 0;
        i < localStorage.length;
        i++
    ) {

        const storageKey =
            localStorage.key(i);

        if (
            storageKey &&
            storageKey.startsWith(
                "sales_report_"
            ) &&
            storageKey !== key
        ) {

            previousDates.push(
                storageKey.replace(
                    "sales_report_",
                    ""
                )
            );
        }
    }


    previousDates.sort().reverse();


    for (
        const previousDate
        of previousDates
    ) {

        try {

            const previousData =
                JSON.parse(
                    localStorage.getItem(
                        getStorageKey(
                            previousDate
                        )
                    )
                );


            const categoryData =
                previousData?.[
                    AppState.currentCategory
                ];


            if (
                Array.isArray(categoryData) &&
                categoryData.some(
                    item =>
                        item &&
                        typeof item.name === "string" &&
                        item.name.trim()
                )
            ) {

                const copiedProducts =
                    categoryData
                        .filter(
                            item =>
                                item &&
                                typeof item.name === "string" &&
                                item.name.trim()
                        )
                        .map(item => ({
                            name:
                                item.name.trim(),

                            outQty: 0,

                            returnQty: 0,

                            basePrice:
                                Math.max(
                                    0,
                                    Number(
                                        item.basePrice
                                    ) || 0
                                ),

                            sellPrice:
                                Math.max(
                                    0,
                                    Number(
                                        item.sellPrice
                                    ) || 0
                                )
                        }));


                const newStore = {
                    ...storedData,

                    [AppState.currentCategory]:
                        copiedProducts
                };


                try {

                    localStorage.setItem(
                        key,
                        JSON.stringify(
                            newStore
                        )
                    );

                } catch (error) {

                    console.warn(
                        "Could not initialize new date:",
                        error
                    );
                }


                return normalizeStore(
                    newStore
                );
            }

        } catch (error) {

            console.warn(
                `Could not read previous report: ${previousDate}`,
                error
            );
        }
    }


    return normalizeStore(
        storedData
    );
}


// ======================================================
// NORMALIZE STORE
// ======================================================

function normalizeStore(store) {

    const normalized = {};


    CATEGORIES.forEach(category => {

        const rows =
            Array.isArray(
                store?.[category]
            )
                ? store[category]
                : [];


        normalized[category] =
            rows.map(row => {

                const outQty =
                    Math.max(
                        0,
                        Number(
                            row?.outQty
                        ) || 0
                    );


                const returnQty =
                    Math.min(
                        outQty,

                        Math.max(
                            0,
                            Number(
                                row?.returnQty
                            ) || 0
                        )
                    );


                return {

                    name:
                        typeof row?.name === "string"
                            ? row.name
                            : "",

                    outQty,

                    returnQty,

                    basePrice:
                        Math.max(
                            0,
                            Number(
                                row?.basePrice
                            ) || 0
                        ),

                    sellPrice:
                        Math.max(
                            0,
                            Number(
                                row?.sellPrice
                            ) || 0
                        )
                };
            });
    });


    return normalized;
}


// ======================================================
// MONTHLY SUMMARY
// ======================================================

function aggregateMonthlyData(
    dateStr
) {

    const [
        year,
        month
    ] =
        dateStr.split("-");


    const aggregated = {};


    CATEGORIES.forEach(
        category => {
            aggregated[category] = [];
        }
    );


    const daysInMonth =
        new Date(
            Number(year),
            Number(month),
            0
        ).getDate();


    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const currentDay =
            String(day).padStart(
                2,
                "0"
            );


        const currentDate =
            `${year}-${month}-${currentDay}`;


        const saved =
            localStorage.getItem(
                getStorageKey(
                    currentDate
                )
            );


        if (!saved) continue;


        let dailyData;


        try {

            dailyData =
                JSON.parse(saved);

        } catch (error) {

            console.warn(
                `Invalid data for ${currentDate}`,
                error
            );

            continue;
        }


        CATEGORIES.forEach(
            category => {

                const rows =
                    dailyData?.[category];

                if (!Array.isArray(rows)) {
                    return;
                }


                rows.forEach(item => {

                    if (
                        !item ||
                        typeof item.name !== "string" ||
                        !item.name.trim()
                    ) {
                        return;
                    }


                    const cleanName =
                        item.name.trim();


                    /*
                     * IMPORTANT:
                     *
                     * Calculate this row using the
                     * price values from THIS specific day.
                     *
                     * This prevents incorrect monthly
                     * totals when product prices change
                     * during the month.
                     */

                    const dailyResult =
                        calculateRow(item);


                    const existingIndex =
                        aggregated[
                            category
                        ].findIndex(
                            product =>
                                product.name
                                    .trim()
                                    .toLowerCase() ===
                                cleanName
                                    .toLowerCase()
                        );


                    if (
                        existingIndex === -1
                    ) {

                        aggregated[
                            category
                        ].push({

                            name:
                                cleanName,

                            outQty:
                                dailyResult.outQty,

                            returnQty:
                                dailyResult.returnQty,

                            basePrice:
                                dailyResult.basePrice,

                            sellPrice:
                                dailyResult.sellPrice,

                            soldQty:
                                dailyResult.soldQty,

                            totalSales:
                                dailyResult.totalSales,

                            profit:
                                dailyResult.profit,

                            /*
                             * This marker tells calculateRow()
                             * that this row already contains
                             * aggregated monthly totals.
                             */
                            isMonthlyAggregate:
                                true
                        });

                    } else {

                        const existing =
                            aggregated[
                                category
                            ][
                                existingIndex
                            ];


                        existing.outQty +=
                            dailyResult.outQty;


                        existing.returnQty +=
                            dailyResult.returnQty;


                        existing.soldQty +=
                            dailyResult.soldQty;


                        existing.totalSales +=
                            dailyResult.totalSales;


                        existing.profit +=
                            dailyResult.profit;


                        /*
                         * Keep the latest day's prices
                         * for display, preserving the
                         * previous UI behavior.
                         *
                         * These prices are NOT used to
                         * recalculate monthly totals.
                         */
                        existing.basePrice =
                            dailyResult.basePrice;


                        existing.sellPrice =
                            dailyResult.sellPrice;
                    }
                });

            }
        );
    }


    /*
     * Do NOT call normalizeStore() here.
     *
     * normalizeStore() intentionally keeps only
     * the normal daily-report fields and would remove
     * the monthly aggregate totals.
     */
    return aggregated;
}


// ======================================================
// CALCULATIONS
// ======================================================

function calculateRow(row) {

    /*
     * MONTHLY AGGREGATE
     *
     * Monthly rows already contain the correctly
     * calculated totals from each individual day.
     *
     * Therefore we must NOT calculate:
     *
     *   totalSales = monthlySoldQty × latestSellPrice
     *
     * or:
     *
     *   profit = monthlySoldQty ×
     *            (latestSellPrice - latestBasePrice)
     *
     * because prices may have changed during the month.
     */

    if (
        row?.isMonthlyAggregate === true
    ) {

        const rawOutQty =
            Number(row?.outQty);


        const outQty =
            Number.isFinite(
                rawOutQty
            )
                ? Math.max(
                    0,
                    rawOutQty
                )
                : 0;


        const rawReturnQty =
            Number(row?.returnQty);


        const returnQty =
            Math.min(

                outQty,

                Number.isFinite(
                    rawReturnQty
                )
                    ? Math.max(
                        0,
                        rawReturnQty
                    )
                    : 0
            );


        const rawBasePrice =
            Number(row?.basePrice);


        const basePrice =
            Number.isFinite(
                rawBasePrice
            )
                ? Math.max(
                    0,
                    rawBasePrice
                )
                : 0;


        const rawSellPrice =
            Number(row?.sellPrice);


        const sellPrice =
            Number.isFinite(
                rawSellPrice
            )
                ? Math.max(
                    0,
                    rawSellPrice
                )
                : 0;


        const rawSoldQty =
            Number(row?.soldQty);


        const soldQty =
            Number.isFinite(
                rawSoldQty
            )
                ? Math.max(
                    0,
                    rawSoldQty
                )
                : Math.max(
                    0,
                    outQty - returnQty
                );


        const rawTotalSales =
            Number(row?.totalSales);


        const totalSales =
            Number.isFinite(
                rawTotalSales
            )
                ? Math.max(
                    0,
                    rawTotalSales
                )
                : 0;


        const rawProfit =
            Number(row?.profit);


        const profit =
            Number.isFinite(
                rawProfit
            )
                ? rawProfit
                : 0;


        return {

            outQty,

            returnQty,

            basePrice,

            sellPrice,

            soldQty,

            totalSales,

            profit
        };
    }


    /*
     * DAILY CALCULATION
     *
     * Existing Daily Report logic remains unchanged.
     */

    const rawOutQty =
        Number(row?.outQty);


    const outQty =
        Number.isFinite(
            rawOutQty
        )
            ? Math.max(
                0,
                rawOutQty
            )
            : 0;


    const rawReturnQty =
        Number(row?.returnQty);


    const returnQty =
        Math.min(

            outQty,

            Number.isFinite(
                rawReturnQty
            )
                ? Math.max(
                    0,
                    rawReturnQty
                )
                : 0
        );


    const rawBasePrice =
        Number(row?.basePrice);


    const basePrice =
        Number.isFinite(
            rawBasePrice
        )
            ? Math.max(
                0,
                rawBasePrice
            )
            : 0;


    const rawSellPrice =
        Number(row?.sellPrice);


    const sellPrice =
        Number.isFinite(
            rawSellPrice
        )
            ? Math.max(
                0,
                rawSellPrice
            )
            : 0;


    const soldQty =
        outQty - returnQty;


    const totalSales =
        soldQty * sellPrice;


    const profit =
        soldQty *
        (
            sellPrice -
            basePrice
        );


    return {

        outQty,

        returnQty,

        basePrice,

        sellPrice,

        soldQty,

        totalSales,

        profit
    };
}


// ======================================================
// FORMATTERS
// ======================================================

function formatNumber(value) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {
        return "0";
    }


    return number.toLocaleString(
        "en-US",
        {
            maximumFractionDigits:
                2
        }
    );
}


function formatCurrency(value) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {
        return "৳0.00";
    }


    return `৳${number.toLocaleString(
        "en-US",
        {
            minimumFractionDigits:
                2,

            maximumFractionDigits:
                2
        }
    )}`;
}


// ======================================================
// HTML ESCAPE
// ======================================================

function escapeHTML(value) {

    return String(
        value ?? ""
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}


// ======================================================
// TABLE RENDERING
// ======================================================

function renderTableRows() {

    const tbody =
        document.getElementById(
            "sales-table-body"
        );


    if (!tbody) return;


    tbody.innerHTML = "";


    editHistoryKeys.clear();


    const rows =
        AppState.store[
            AppState.currentCategory
        ] || [];


    const isMonthly =
        AppState.reportView ===
        "monthly";


    // Daily report always keeps
    // at least 5 editable rows.

    if (!isMonthly) {

        while (
            rows.length < 5
        ) {

            rows.push({

                name: "",

                outQty: 0,

                returnQty: 0,

                basePrice: 0,

                sellPrice: 0
            });
        }
    }


    AppState.store[
        AppState.currentCategory
    ] = rows;


    // Monthly report with no data.

    if (
        isMonthly &&
        rows.length === 0
    ) {

        const emptyRow =
            document.createElement(
                "tr"
            );


        emptyRow.className =
            "empty-row";


        emptyRow.innerHTML = `
            <td colspan="8">
                No sales data available for this month.
            </td>
        `;


        tbody.appendChild(
            emptyRow
        );


        return;
    }


    rows.forEach(
        (row, index) => {

            const result =
                calculateRow(row);


            const tr =
                document.createElement(
                    "tr"
                );


            if (isMonthly) {

                tr.innerHTML = `

                    <td class="product-cell">
                        ${escapeHTML(row.name)}
                    </td>

                    <td>
                        ${formatNumber(result.outQty)}
                    </td>

                    <td>
                        ${formatNumber(result.returnQty)}
                    </td>

                    <td class="calculated-cell">
                        ${formatNumber(result.soldQty)}
                    </td>

                    <td>
                        ${formatCurrency(result.basePrice)}
                    </td>

                    <td>
                        ${formatCurrency(result.sellPrice)}
                    </td>

                    <td class="calculated-cell">
                        ${formatCurrency(result.totalSales)}
                    </td>

                    <td class="calculated-cell profit-cell">
                        ${formatCurrency(result.profit)}
                    </td>

                `;

            } else {

                tr.innerHTML = `

                    <td>

                        <input
                            type="text"
                            class="product-name-input"
                            value="${escapeHTML(row.name)}"
                            placeholder="Product name"
                            data-index="${index}"
                            data-field="name"
                        >

                    </td>


                    <td>

                        <input
                            type="number"
                            min="0"
                            step="1"
                            value="${result.outQty}"
                            data-index="${index}"
                            data-field="outQty"
                        >

                    </td>


                    <td>

                        <input
                            type="number"
                            min="0"
                            step="1"
                            value="${result.returnQty}"
                            data-index="${index}"
                            data-field="returnQty"
                        >

                    </td>


                    <td class="calculated-cell">
                        ${formatNumber(result.soldQty)}
                    </td>


                    <td>

                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value="${result.basePrice}"
                            data-index="${index}"
                            data-field="basePrice"
                        >

                    </td>


                    <td>

                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value="${result.sellPrice}"
                            data-index="${index}"
                            data-field="sellPrice"
                        >

                    </td>


                    <td class="calculated-cell">
                        ${formatCurrency(result.totalSales)}
                    </td>


                    <td class="calculated-cell profit-cell">
                        ${formatCurrency(result.profit)}
                    </td>


                    <td class="action-cell no-print">

                        <button
                            type="button"
                            class="delete-row-btn"
                            data-delete-index="${index}"
                            title="Delete row"
                        >
                            🗑️
                        </button>

                    </td>

                `;
            }


            if (
                !row.name &&
                !result.outQty &&
                !result.returnQty &&
                !result.basePrice &&
                !result.sellPrice
            ) {

                tr.classList.add(
                    "screen-empty-row"
                );
            }


            tbody.appendChild(
                tr
            );
        }
    );


    bindTableEvents();

    updateActionControlsState();
}


// ======================================================
// TABLE EVENTS
// ======================================================

function bindTableEvents() {

    const tbody =
        document.getElementById(
            "sales-table-body"
        );


    if (!tbody) return;


    tbody
        .querySelectorAll(
            "input[data-index]"
        )
        .forEach(input => {

            input.addEventListener(
                "input",
                onInputChange
            );


            input.addEventListener(
                "blur",
                () => {

                    editHistoryKeys.delete(

                        `${AppState.currentCategory}:` +
                        `${input.dataset.index}:` +
                        `${input.dataset.field}`

                    );

                }
            );

        });


    tbody
        .querySelectorAll(
            "[data-delete-index]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    openDeleteModal(
                        Number(
                            button.dataset
                                .deleteIndex
                        )
                    );

                }
            );

        });
}


// ======================================================
// INPUT CHANGE
// ======================================================

function onInputChange(event) {

    if (
        AppState.reportView !==
        "daily"
    ) {
        return;
    }


    const input =
        event.target;


    const index =
        Number(
            input.dataset.index
        );


    const field =
        input.dataset.field;


    const rows =
        AppState.store[
            AppState.currentCategory
        ] || [];


    const row =
        rows[index];


    if (
        !row ||
        !field ||
        !Number.isInteger(index)
    ) {
        return;
    }


    const historyKey =
        `${AppState.currentCategory}:` +
        `${index}:` +
        `${field}`;


    if (
        !editHistoryKeys.has(
            historyKey
        )
    ) {

        recordHistory();

        editHistoryKeys.add(
            historyKey
        );
    }


    if (
        field === "name"
    ) {

        row.name =
            input.value;

    } else {

        const parsed =
            Number(
                input.value
            );


        let value =
            Number.isFinite(parsed)
                ? Math.max(
                    0,
                    parsed
                )
                : 0;


        if (
            field === "returnQty"
        ) {

            value =
                Math.min(
                    value,

                    Math.max(
                        0,
                        Number(
                            row.outQty
                        ) || 0
                    )
                );
        }


        row[field] =
            value;
    }


    // If Out Qty decreases,
    // Return Qty cannot remain higher.

    if (
        field === "outQty"
    ) {

        row.returnQty =
            Math.min(

                Math.max(
                    0,
                    Number(
                        row.returnQty
                    ) || 0
                ),

                Math.max(
                    0,
                    Number(
                        row.outQty
                    ) || 0
                )
            );
    }


    saveCurrentState();


    const result =
        calculateRow(row);


    const tr =
        input.closest("tr");


    if (!tr) return;


    const cells =
        tr.querySelectorAll(
            ".calculated-cell"
        );


    if (
        cells.length >= 3
    ) {

        cells[0].textContent =
            formatNumber(
                result.soldQty
            );


        cells[1].textContent =
            formatCurrency(
                result.totalSales
            );


        cells[2].textContent =
            formatCurrency(
                result.profit
            );
    }


    const numberInputs =
        tr.querySelectorAll(
            'input[type="number"]'
        );


    if (
        numberInputs.length >= 2
    ) {

        numberInputs[0].value =
            result.outQty;


        numberInputs[1].value =
            result.returnQty;
    }


    tr.classList.toggle(

        "screen-empty-row",

        !row.name &&
        !result.outQty &&
        !result.returnQty &&
        !result.basePrice &&
        !result.sellPrice
    );


    calculateMetrics();

    updatePrintHeaderInfo();

    updateActionControlsState();
}


// ======================================================
// ROW ACTIONS
// ======================================================

function addRow() {

    if (
        AppState.reportView !==
        "daily"
    ) {
        return;
    }


    recordHistory();

    editHistoryKeys.clear();


    const rows =
        AppState.store[
            AppState.currentCategory
        ] || [];


    rows.push({

        name: "",

        outQty: 0,

        returnQty: 0,

        basePrice: 0,

        sellPrice: 0
    });


    AppState.store[
        AppState.currentCategory
    ] = rows;


    saveCurrentState();

    renderTableRows();

    calculateMetrics();
}


// ======================================================
// DELETE MODAL
// ======================================================

function openDeleteModal(index) {

    if (
        AppState.reportView !==
        "daily"
    ) {
        return;
    }


    AppState.deleteTargetIndex =
        index;


    const row =
        AppState.store[
            AppState.currentCategory
        ]?.[index];


    const text =
        document.getElementById(
            "delete-modal-text"
        );


    const modal =
        document.getElementById(
            "delete-modal"
        );


    if (text) {

        text.textContent =
            row?.name

                ? `Are you sure you want to delete "${row.name}"?`

                : "Are you sure you want to delete this item?";
    }


    if (modal) {

        modal.style.display =
            "flex";

        modal.classList.add(
            "active"
        );
    }
}


function closeDeleteModal() {

    AppState.deleteTargetIndex =
        null;


    const modal =
        document.getElementById(
            "delete-modal"
        );


    if (modal) {

        modal.classList.remove(
            "active"
        );

        modal.style.display =
            "none";
    }
}


function confirmDelete() {

    if (
        AppState.reportView !==
        "daily"
    ) {
        return;
    }


    const index =
        AppState.deleteTargetIndex;


    const rows =
        AppState.store[
            AppState.currentCategory
        ] || [];


    if (
        index === null ||
        index === undefined ||
        !rows[index]
    ) {

        closeDeleteModal();

        return;
    }


    recordHistory();

    editHistoryKeys.clear();


    rows.splice(
        index,
        1
    );


    saveCurrentState();

    renderTableRows();

    calculateMetrics();

    closeDeleteModal();
}


// ======================================================
// CLEAR ALL
// ======================================================

function openClearModal() {

    if (
        AppState.reportView !==
        "daily"
    ) {
        return;
    }


    const modal =
        document.getElementById(
            "clear-all-modal"
        );


    if (modal) {

        modal.style.display =
            "flex";

        modal.classList.add(
            "active"
        );
    }
}


function closeClearModal() {

    const modal =
        document.getElementById(
            "clear-all-modal"
        );


    if (modal) {

        modal.classList.remove(
            "active"
        );

        modal.style.display =
            "none";
    }
}


function confirmClearAll() {

    if (
        AppState.reportView !==
        "daily"
    ) {
        return;
    }


    recordHistory();

    editHistoryKeys.clear();


    AppState.store[
        AppState.currentCategory
    ] = [];


    saveCurrentState();

    renderTableRows();

    calculateMetrics();

    closeClearModal();
}


// ======================================================
// METRICS
// ======================================================

function calculateMetrics() {

    const rows =
        AppState.store[
            AppState.currentCategory
        ] || [];


    let totalSellQty = 0;

    let totalSellAmount = 0;

    let totalProfit = 0;


    rows.forEach(row => {

        const result =
            calculateRow(row);


        totalSellQty +=
            result.soldQty;


        totalSellAmount +=
            result.totalSales;


        totalProfit +=
            result.profit;
    });


    const sellQtyElement =
        document.getElementById(
            "total-sell-qty"
        );


    const sellAmountElement =
        document.getElementById(
            "total-sell-amount"
        );


    const profitElement =
        document.getElementById(
            "total-profit"
        );


    if (sellQtyElement) {

        sellQtyElement.textContent =
            formatNumber(
                totalSellQty
            );
    }


    if (sellAmountElement) {

        sellAmountElement.textContent =
            formatCurrency(
                totalSellAmount
            );
    }


    if (profitElement) {

        profitElement.textContent =
            formatCurrency(
                totalProfit
            );
    }
}


// ======================================================
// PRINT / PDF HELPERS
// ======================================================

function getReportTitle() {

    return AppState.reportView ===
        "monthly"

        ? "Monthly Sales Summary"

        : "Daily Sales Report";
}


function getFormattedReportDate() {

    const value =
        document.getElementById(
            "report-date"
        )?.value;


    if (!value) return "";


    const date =
        new Date(
            `${value}T00:00:00`
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }


    return date.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",

            month: "short",

            year: "numeric"
        }
    );
}


function isMeaningfulRow(row) {

    const inputs =
        [
            ...row.querySelectorAll(
                "input"
            )
        ];


    if (!inputs.length) {

        return !row.classList.contains(
            "empty-row"
        );
    }


    const name =
        inputs.find(
            input =>
                input.type === "text"
        )?.value?.trim() || "";


    const hasNumber =
        inputs.some(
            input => {

                if (
                    input.type === "text"
                ) {
                    return false;
                }


                const value =
                    Number(
                        input.value
                    );


                return (
                    Number.isFinite(
                        value
                    ) &&
                    value > 0
                );
            }
        );


    return Boolean(
        name ||
        hasNumber
    );
}


// ======================================================
// PRINT META
// ======================================================

function createPrintMeta() {

    const meta =
        document.createElement(
            "div"
        );


    meta.className =
        "print-report-meta";


    meta.innerHTML = `

        <div class="print-report-title">
            ${escapeHTML(
                getReportTitle()
            )}
        </div>

        <div class="print-report-info">

            <span>
                <strong>
                    Category:
                </strong>

                ${escapeHTML(
                    AppState.currentCategory
                )}
            </span>

            <span>
                <strong>
                    Date:
                </strong>

                ${escapeHTML(
                    getFormattedReportDate()
                )}
            </span>

        </div>

    `;


    return meta;
}


// ======================================================
// PREPARE PRINT
// ======================================================

function preparePrint() {

    document.body.classList.add(
        "print-mode"
    );


    const container =
        document.querySelector(
            ".container"
        );


    if (!container) return;


    const oldMeta =
        container.querySelector(
            ".print-report-meta"
        );


    if (oldMeta) {
        oldMeta.remove();
    }


    const meta =
        createPrintMeta();


    container.insertBefore(
        meta,
        container.firstChild
    );


    const rows =
        container.querySelectorAll(
            "#sales-table-body tr"
        );


    rows.forEach(row => {

        row.classList.toggle(
            "print-hidden-row",
            !isMeaningfulRow(row)
        );

    });
}


// ======================================================
// CLEANUP PRINT
// ======================================================

function cleanupPrint() {

    document.body.classList.remove(
        "print-mode"
    );


    const meta =
        document.querySelector(
            ".print-report-meta"
        );


    if (meta) {
        meta.remove();
    }


    document
        .querySelectorAll(
            ".print-hidden-row"
        )
        .forEach(row => {

            row.classList.remove(
                "print-hidden-row"
            );

        });
}


// ======================================================
// PRINT
// ======================================================

function printReport() {

    preparePrint();


    window.setTimeout(
        () => {

            window.print();

        },
        50
    );
}


// ======================================================
// BUILD PDF DOCUMENT
// ======================================================

function buildPDFDocument() {

    const source =
        document.querySelector(
            ".container"
        );


    if (!source) {
        return null;
    }


    const clone =
        source.cloneNode(true);


    clone.classList.add(
        "pdf-export-sheet"
    );


    // Remove interactive controls.

    clone
        .querySelectorAll(
            ".no-print, .action-bar, button, select, input[type='date']"
        )
        .forEach(
            element =>
                element.remove()
        );


    // Remove screen toolbar.

    clone
        .querySelector(
            ".toolbar"
        )
        ?.remove();


    // Remove empty rows.

    clone
        .querySelectorAll(
            "#sales-table-body tr"
        )
        .forEach(row => {

            if (
                !isMeaningfulRow(row)
            ) {

                row.remove();
            }

        });


    // Convert inputs to text.

    clone
        .querySelectorAll(
            "input"
        )
        .forEach(input => {

            const span =
                document.createElement(
                    "span"
                );


            span.className =
                "pdf-value";


            span.textContent =
                input.value || "";


            input.replaceWith(
                span
            );

        });


    // Remove original app header.

    const oldHeader =
        clone.querySelector(
            ".app-header"
        );


    if (oldHeader) {
        oldHeader.remove();
    }


    // Create clean PDF header.

    const header =
        document.createElement(
            "div"
        );


    header.className =
        "pdf-report-header";


    header.innerHTML = `

        <div>

            <div class="pdf-report-title">
                ${escapeHTML(
                    getReportTitle()
                )}
            </div>

            <div class="pdf-report-subtitle">
                Sales Report Management System
            </div>

        </div>


        <div class="pdf-report-meta">

            <div>
                <strong>
                    Category:
                </strong>

                ${escapeHTML(
                    AppState.currentCategory
                )}
            </div>


            <div>
                <strong>
                    Date:
                </strong>

                ${escapeHTML(
                    getFormattedReportDate()
                )}
            </div>

        </div>

    `;


    clone.insertBefore(
        header,
        clone.firstChild
    );


    // Footer.

    const footer =
        document.createElement(
            "div"
        );


    footer.className =
        "pdf-report-footer";


    footer.textContent =
        "Generated from Sales Report Management System";


    clone.appendChild(
        footer
    );


    return clone;
}


// ======================================================
// GENERATE PDF
// ======================================================

async function generatePDF() {

    if (
        typeof html2pdf ===
        "undefined"
    ) {

        alert(
            "PDF library is not loaded."
        );

        return;
    }


    const report =
        buildPDFDocument();


    if (!report) return;


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "pdf-export-wrapper";


    wrapper.appendChild(
        report
    );


    document.body.appendChild(
        wrapper
    );


    const date =
        document.getElementById(
            "report-date"
        )?.value ||
        "report";


    const safeCategory =
        AppState.currentCategory
            .replace(
                /[^a-z0-9_-]+/gi,
                "-"
            );


    /*
      A4 Landscape PDF
      Unit = millimeter
    */

    const options = {

        margin: [
            0.15,
            0.18,
            0.18,
            0.18
        ],


        filename:
            `sales-report-${safeCategory}-${date}.pdf`,


        image: {

            type: "jpeg",

            quality: 0.98
        },


        html2canvas: {

            scale: 2,

            useCORS: true,

            backgroundColor:
                "#ffffff",

            logging: false,

            scrollX: 0,

            scrollY: 0
        },


        pagebreak: {

            mode: [
                "css",
                "legacy"
            ],

            avoid: [
                "tr",
                ".metric-card"
            ]
        },


        jsPDF: {

            // A4 measurement unit
            unit: "mm",

            // A4 page
            format: "a4",

            // Landscape
            orientation: "landscape",

            compress: true
        }
    };


    try {

        await html2pdf()

            .set(options)

            .from(report)

            .save();

    } catch (error) {

        console.error(
            "PDF generation failed:",
            error
        );

        alert(
            "PDF could not be generated. Please try again."
        );

    } finally {

        wrapper.remove();
    }
}


// ======================================================
// PRINT HEADER INFO
// ======================================================

function updatePrintHeaderInfo() {

    const date =
        document.getElementById(
            "report-date"
        )?.value || "";


    const dateElement =
        document.getElementById(
            "print-date-display"
        );


    const categoryElement =
        document.getElementById(
            "print-category-display"
        );


    if (dateElement) {

        dateElement.textContent =
            getFormattedReportDate() ||
            date;
    }


    if (categoryElement) {

        categoryElement.textContent =
            AppState.currentCategory;
    }
}


// ======================================================
// ACTION CONTROLS
// ======================================================

function updateActionControlsState() {

    const isMonthly =
        AppState.reportView ===
        "monthly";


    const undoButton =
        document.getElementById(
            "undo-btn"
        );


    const addButton =
        document.getElementById(
            "add-row-btn"
        );


    const clearButton =
        document.getElementById(
            "clear-all-btn"
        );


    const actionHeader =
        document.getElementById(
            "action-header"
        );


    if (undoButton) {

        undoButton.disabled =
            isMonthly ||
            AppState.historyStack
                .length === 0;
    }


    if (addButton) {

        addButton.style.display =
            isMonthly
                ? "none"
                : "";
    }


    if (clearButton) {

        clearButton.style.display =
            isMonthly
                ? "none"
                : "";
    }


    if (actionHeader) {

        actionHeader.style.display =
            isMonthly
                ? "none"
                : "";
    }
}


// ======================================================
// GLOBAL EVENTS
// ======================================================

function bindGlobalEvents() {

    const dateInput =
        document.getElementById(
            "report-date"
        );


    const categorySelect =
        document.getElementById(
            "category-select"
        );


    const reportViewSelect =
        document.getElementById(
            "report-view-select"
        );


    const themeButton =
        document.getElementById(
            "theme-toggle"
        );


    const printButton =
        document.getElementById(
            "print-btn"
        );


    const pdfButton =
        document.getElementById(
            "pdf-btn"
        );


    const undoButton =
        document.getElementById(
            "undo-btn"
        );


    const addButton =
        document.getElementById(
            "add-row-btn"
        );


    const clearButton =
        document.getElementById(
            "clear-all-btn"
        );


    const deleteConfirmButton =
        document.getElementById(
            "confirm-delete-btn"
        );


    const deleteCancelButton =
        document.querySelector(
            "#delete-modal .btn-secondary"
        );


    const clearConfirmButton =
        document.querySelector(
            "#clear-all-modal .btn-danger"
        );


    const clearCancelButton =
        document.querySelector(
            "#clear-all-modal .btn-secondary"
        );


    dateInput?.addEventListener(
        "change",
        loadReportData
    );


    categorySelect?.addEventListener(
        "change",
        event => {

            AppState.currentCategory =
                event.target.value;

            loadReportData();
        }
    );


    reportViewSelect?.addEventListener(
        "change",
        event => {

            AppState.reportView =
                event.target.value;

            loadReportData();
        }
    );


    themeButton?.addEventListener(
        "click",
        toggleTheme
    );


    printButton?.addEventListener(
        "click",
        printReport
    );


    pdfButton?.addEventListener(
        "click",
        generatePDF
    );


    undoButton?.addEventListener(
        "click",
        undo
    );


    addButton?.addEventListener(
        "click",
        addRow
    );


    clearButton?.addEventListener(
        "click",
        openClearModal
    );


    deleteConfirmButton?.addEventListener(
        "click",
        confirmDelete
    );


    deleteCancelButton?.addEventListener(
        "click",
        closeDeleteModal
    );


    clearConfirmButton?.addEventListener(
        "click",
        confirmClearAll
    );


    clearCancelButton?.addEventListener(
        "click",
        closeClearModal
    );


    window.addEventListener(
        "afterprint",
        cleanupPrint
    );
}


// ======================================================
// MODAL / KEYBOARD HELPERS
// ======================================================

function bindModalHelpers() {

    const deleteModal =
        document.getElementById(
            "delete-modal"
        );


    const clearModal =
        document.getElementById(
            "clear-all-modal"
        );


    [
        deleteModal,
        clearModal
    ].forEach(modal => {

        if (!modal) return;


        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target !==
                    modal
                ) {
                    return;
                }


                modal.classList.remove(
                    "active"
                );


                modal.style.display =
                    "none";
            }
        );
    });


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !==
                "Escape"
            ) {
                return;
            }


            closeDeleteModal();

            closeClearModal();
        }
    );
}


// ======================================================
// START APPLICATION
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    initApp
);

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("./sw.js")
            .then(() => {
                console.log("Service Worker registered successfully.");
            })
            .catch(error => {
                console.error("Service Worker registration failed:", error);
            });
    });
}
