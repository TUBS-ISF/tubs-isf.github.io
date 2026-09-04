/**
 * Multi-Select Dropdown Filtering for DataTables
 * 
 * This script enhances a DataTable with multi-select dropdown filters for each column.
 * Users can select multiple filter values, and the table updates dynamically to show
 * only the rows that match the selected criteria.
 * 
 * @author Lennart Pape
 * @date 2026-09-04
 * @version 2.2.0
 * @requires jQuery, DataTables, PapaParse, Bootstrap
 */

// Prevent browser scroll restoration
if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
}

// Global state
let activeFilters = {};
let table;
let currentlyOpenDropdown = null;
let isFilteringInProgress = false;

const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d');

/**
 * Builds a CSS font shorthand string from an element's computed style.
 * Used to keep canvas text measurement in sync with the rendered font.
 *
 * @param {HTMLElement} el - Element whose font styles to read.
 * @returns {string} CSS font shorthand
 */
function getElementFont(el) {
    const style = window.getComputedStyle(el);
    return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

/**
 * Measures the rendered pixel width of a text string for a given font.
 *
 * @param {string} text - Text to measure.
 * @param {string} font - CSS font shorthand to measure with.
 * @returns {number} Width in pixels.
 */
function getTextWidth(text, font) {
    measureCtx.font = font;
    return measureCtx.measureText(text).width;
}


/**
 * Truncates text with an ellipsis to fit within maxWidth, using
 * binary search to find the longest fitting substring.
 *
 * @param {string} text - Text to truncate.
 * @param {number} maxWidth - Available width in pixels.
 * @param {string} font - CSS font shorthand to measure with.
 * @returns {string} Truncated text ending in "…", or "" if no space.
 */
function truncateToWidth(text, maxWidth, font) {
    if (maxWidth <= 0) return '';
    if (getTextWidth(text, font) <= maxWidth) return text;

    let low = 0;
    let high = text.length;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        const candidate = text.slice(0, mid) + '…';
        if (getTextWidth(candidate, font) <= maxWidth) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    return low > 0 ? text.slice(0, low) + '…' : '…';
}

/**
 * Updates the dropdown trigger label based on the active selection.
 * Fits as many full values as possible into the available width; the
 * next value is truncated with "…" if it partially fits, otherwise the
 * remainder is summarized as "(+X)". Falls back to "All" if empty.
 * Sets 'title' to the full filter list for a native tooltip, and stores
 * the filters on the element's data so the label can be recalculated later.
 * 
 * @param {jQuery} dropdown - The trigger element containing the label to be updated. 
 * @param {Array<string>} filters - The array of currently selected filter values for this column.
 */
function updateDropdownText(dropdown, filters) {
    dropdown.data('filters', filters);

    const textEl = dropdown.find('.dropdown-text');
    textEl.empty().removeAttr('title');

    if (filters.length === 0) {
        textEl.text('All').removeClass('selected-values');
        return;
    }

    const SAFETY_MARGIN = 4;
    const MIN_PARTIAL_CHARS = 4;
    const separator = ', ';
    const fullText = filters.join(separator);
    const font = getElementFont(textEl[0]);
    const availableWidth = textEl[0].clientWidth - SAFETY_MARGIN;

    textEl.addClass('selected-values').attr('title', fullText);

    // Fit as many full values as possible, reserving space for a "(+N)" suffix
    let shownCount = 0;
    for (let i = 0; i < filters.length; i++) {
        const candidate = filters.slice(0, i + 1).join(separator);
        const remainingAfter = filters.length - (i + 1);
        const suffix = remainingAfter > 0 ? ` (+${remainingAfter})` : '';

        if (getTextWidth(candidate + suffix, font) <= availableWidth) {
            shownCount = i + 1;
        } else {
            break;
        }
    }

    let displayValue = filters.slice(0, shownCount).join(separator);
    let remainingCount = filters.length - shownCount;

    // If a next value exists, try partially truncating it with "…" instead
    // of immediately falling back to "(+X)"
    if (remainingCount > 0) {
        const nextValue = filters[shownCount];
        const restAfterNext = remainingCount - 1;
        const prefix = shownCount > 0 ? displayValue + separator : '';
        const suffix = restAfterNext > 0 ? ` (+${restAfterNext})` : '';

        const widthForNext = availableWidth - getTextWidth(prefix, font) - getTextWidth(suffix, font);
        const truncatedNext = truncateToWidth(nextValue, widthForNext, font);

        const meaningfulLength = truncatedNext.replace('…', '').length;
        if (meaningfulLength >= MIN_PARTIAL_CHARS) {
            displayValue = prefix + truncatedNext;
            remainingCount = restAfterNext;
        }
    }

    // Edge case: not even the first value fits fully or partially above
    if (shownCount === 0 && displayValue === '') {
        remainingCount = filters.length - 1;
        const suffix = remainingCount > 0 ? ` (+${remainingCount})` : '';
        const suffixWidth = remainingCount > 0 ? getTextWidth(suffix, font) : 0;
        displayValue = truncateToWidth(filters[0], availableWidth - suffixWidth, font);
    }

    textEl.append($('<span class="dropdown-text-value">').text(displayValue));

    if (remainingCount > 0) {
        textEl.append($('<span class="dropdown-text-count">').text(`(+${remainingCount})`));
    }
}

/**
 * Calculates the screen position for the dropdown menu.
 * Implements a basic collision detection algorithm to ensure:
 * - The menu does not overflow the right edge of the viewport.
 * - The menu flips to open upwards if there is insufficient space at the bottom.
 * - When opening upwards, the menu is anchored to the bottom edge of the trigger
 *   so it grows upwards dynamically (e.g. when search filters reduce the options).
 * 
 * @param {jQuery} dropdown - The trigger element (the button/input). 
 * @param {jQuery} optionsContainer - The floating menu container to be positioned.
 */
function repositionDropdown(dropdown, optionsContainer) {
    const rect = dropdown[0].getBoundingClientRect();
    const menuWidth = optionsContainer.outerWidth();
    const menuHeight = optionsContainer.outerHeight();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let leftPosition = rect.left;
    if (rect.left + menuWidth > windowWidth) {
        leftPosition = rect.right - menuWidth;
        if (leftPosition < 0) leftPosition = 10;
    }
    
    const spaceBelow = windowHeight - rect.bottom;
    const spaceAbove = rect.top;
    const opensUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    optionsContainer.css({'top': '', 'bottom': ''});

    if (opensUpward) {
        optionsContainer.css({
            'bottom': (windowHeight - rect.top + 2) + 'px',
            'left': leftPosition + 'px',
            top: 'auto'
        });
    } else {
        optionsContainer.css({
            'top': (rect.bottom + 2) + 'px',
            'left': leftPosition + 'px',
            'bottom': 'auto'
        });
    }
}

/**
 * Creates a custom multi-select dropdown menu for a specific table column.
 * Generates the HTML structure, initializes the internal search functionality,
 * and binds event handlers for option selection and "Apply" logic.
 * 
 * @param {jQuery} container - The target header element (TH) where the dropdown trigger is rendered.
 * @param {Array<string>} options - List of unique values to be displayed as filterable options.
 * @param {Object} column - The DataTables API object for the current column.
 * @param {boolean} [showSearch=true] - Determines whether a text search input is included in the dropdown.
 */
function createMultiSelect(container, options, column, showSearch = true) {
    const multiSelect = $('<div class="multi-select">');
    const dropdown = $('<div class="multi-select-dropdown"><span class="dropdown-text">All</span></div>');
    const optionsContainer = $('<div class="multi-select-options">');
    const searchWrapper = $('<div class="dropdown-search-wrapper"></div>');
    const searchInput = $('<input type="text" class="dropdown-search-input" placeholder="Search...">');

    // Search
    if (showSearch) {
        searchWrapper.append(searchInput);
        optionsContainer.prepend(searchWrapper);
    } else {
        optionsContainer.css('padding-top', '10px');
    }
    
    
    // Unique IDs for tracking and syncing dropdown state
    const uniqueId = 'dropdown-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
    const columnTitle = column.header().textContent;
    optionsContainer.attr('data-dropdown-id', uniqueId);
    optionsContainer.attr('data-column', columnTitle);
    dropdown.attr('data-dropdown-id', uniqueId);
    dropdown.attr('data-column', columnTitle);
    
    // Create "All" option
    const allOption = $('<div class="multi-select-option selected" data-value="">All</div>');
    optionsContainer.append(allOption);
    
    // Create individual options
    options.forEach(option => {
        const optionDiv = $('<div class="multi-select-option" data-value="' + option + '">' + option + '</div>');
        optionDiv.attr('title', option);
        optionsContainer.append(optionDiv);
    });

    // Create Search-filter in dropdowns of table
    searchInput.on('input', function () {
        const searchTerm = $(this).val().toLowerCase();

        optionsContainer.find('.multi-select-option').each(function () {
            if ($(this).data('value') === '') {
                $(this).removeClass('hidden');
                return;
            }
            
            const text = $(this).text().toLowerCase();

            if (text.includes(searchTerm)) {
                $(this).removeClass('hidden');
            } else {
                $(this).addClass('hidden');
            }
        });
    });

    const closeBtn = $('<div class="multi-select-close-btn">Apply</div>');
    optionsContainer.append(closeBtn);

    // Event-Handler Button
    closeBtn.on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        optionsContainer.removeClass('show').hide();
        $('body').removeClass('modal-open');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        currentlyOpenDropdown = null;
    });
    
    multiSelect.append(dropdown);

    const resizeObserver = new ResizeObserver(() => {
        updateDropdownText(dropdown, dropdown.data('filters') || []);
        });
    resizeObserver.observe(dropdown[0]);
    
    // Toggle dropdown visibility
    const toggleDropdown = function() {
        $('body > .multi-select-options').not(optionsContainer).removeClass('show').hide();
        $('body').removeClass('modal-open');

        const isVisible = optionsContainer.hasClass('show');
        const isMobile = window.innerWidth <= 576;
        
        if (isVisible) {
            optionsContainer.removeClass('show').hide();
            $('body').removeClass('modal-open');
            currentlyOpenDropdown = null;
        } else {

            // Reset search before reopening dropdown
            searchInput.val('');
            optionsContainer.find('.multi-select-option').removeClass('hidden');

            optionsContainer.css({
                'display': 'block',
                'visibility': 'hidden',
                'width': isMobile ? '90vw' : 'auto'
            });

            if (isMobile) {
                optionsContainer.css({
                    'visibility' : 'visible',
                    'top': '',
                    'left': ''
                }).addClass('show');

                $('body').addClass('modal-open');
            } else {
                optionsContainer.css({'visibility': 'visible'}).addClass('show');
                optionsContainer.css({'min-width': dropdown.outerWidth() + 'px'});
                repositionDropdown(dropdown, optionsContainer);
            }    
            
            currentlyOpenDropdown = optionsContainer;

            // Set focus on search field when opening dropdown (only in desktop-mode)
            if (showSearch && window.innerWidth > 576) {
                setTimeout(function () {
                    optionsContainer.find('.dropdown-search-input').focus();
                }, 100);
            }
        }
    };
    
    // Handle dropdown click
    dropdown.off('click mousedown touchstart').on('click mousedown touchstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        if (e.type === 'touchstart' || e.type === 'mousedown') {
            toggleDropdown();
        }
        
        return false;
    });
    
    // Handle option selection
    optionsContainer.on('click', '.multi-select-option', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const value = String($(this).data('value'));
        const columnTitle = column.header().textContent;
        
        if (value === '') {
            // "All" selected - clear filters
            optionsContainer.find('.multi-select-option').removeClass('selected');
            $(this).addClass('selected');
            activeFilters[columnTitle] = [];
            updateDropdownText(dropdown, []);

            isFilteringInProgress = true;

            applyFilters();
            updateActiveFiltersDisplay();

            setTimeout(() => {
                isFilteringInProgress = false;
            }, 100);
            
            optionsContainer.removeClass('show').hide();
            $('body').removeClass('modal-open');
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            currentlyOpenDropdown = null;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        } else {
            // Individual option selected
            allOption.removeClass('selected');
            $(this).toggleClass('selected');
            
            if (!activeFilters[columnTitle]) {
                activeFilters[columnTitle] = [];
            }
            
            if ($(this).hasClass('selected')) {
                if (!activeFilters[columnTitle].includes(value)) {
                    activeFilters[columnTitle].push(value.toString());
                }
            } else {
                activeFilters[columnTitle] = activeFilters[columnTitle].filter(v => v !== value);
            }
            
            // Update dropdown display text
            if (activeFilters[columnTitle].length === 0) {
                allOption.addClass('selected');
            }
            updateDropdownText(dropdown, activeFilters[columnTitle]);
            
            isFilteringInProgress = true;

            applyFilters();
            updateActiveFiltersDisplay();
            
            setTimeout(() => {
                isFilteringInProgress = false;
            }, 100);
            
            
            // Reposition after table redraw
            setTimeout(function() {
                if (optionsContainer.hasClass('show') && window.innerWidth > 576) {
                    repositionDropdown(dropdown, optionsContainer);
                }
            }, 50);
        }
    });
    
    // Reposition on window resize
    $(globalThis).on('resize', function() {
        if (optionsContainer.hasClass('show')) {
            repositionDropdown(dropdown, optionsContainer);
        }
    });
    
    container.empty().append(multiSelect);
    $('body').append(optionsContainer);
}

/**
 * Aggregates and applies active filters to DataTable columns.
 * - "Year": Uses strict matching (^value$) to prevent partial hits in list.
 * - Others: Uses boundary logic (^|,\s*) to support comma-separated lists and 
 * properly handle special characters like hyphens in names (e.g., "Hans-Peter").
 */
function applyFilters() {
    table.columns().every(function() {
        const columnTitle = this.header().textContent.trim();
        const filters = activeFilters[columnTitle] || [];
        
        if (filters.length === 0) {
            this.search('', true, false);
        } else {
            const pattern = filters.map(f => {
                const escaped = DataTable.util.escapeRegex(f.toString());
                return columnTitle === "Year" ? `^${escaped}$` : String.raw`(^|,\s*)${escaped}(\s*,|$)`;
            }).join("|");
            
            this.search(`(${pattern})`,true, false);
        }
    });
    table.draw();
}

/**
 * Synchronizes the active filter display area (badges) with the current filter state.
 * Iterates through the activeFilters object and:
 * 1. Generates a removable badge for every selected filter value.
 * 2. Toggles the visibility of the "Clear All" button.
 * 3. Shows a placeholder message when no filters are active.
 * 
 * Each badge includes data attributes for column and value to facilitate easy removal when clicked.
 */
function updateActiveFiltersDisplay() {
    const container = $('#active-filters-container');
    const clearBtn = $('#clear-all-filters');
    
    container.empty();
    
    let hasFilters = false;
    for (const [column, values] of Object.entries(activeFilters)) {
        if (values.length > 0) {
            hasFilters = true;
            values.forEach(value => {
                const badge = $('<span class="filter-badge">')
                    .text(`${column}: ${value}`)
                    .attr('data-column', column)
                    .attr('data-value', value)
                    .append('<span class="remove">×</span>');
                container.append(badge);
            });
        }
    }
    
    if (hasFilters) {
        clearBtn.show();
    } else {
        container.html('<span class="text-muted">No filters applied</span>');
        clearBtn.hide();
    }
}

// Remove individual filter badge
$(document).on('click', '.filter-badge', function() {
    const column = $(this).data('column');
    const value = String($(this).data('value'));
    
    if (activeFilters[column]) {
        activeFilters[column] = activeFilters[column].filter(v => v !== value);
    }
    
    applyFilters();
    updateActiveFiltersDisplay();
    
    const triggerDropdown = $('[data-column="' + column + '"].multi-select-dropdown');
    if (triggerDropdown.length) {
        updateDropdownText(triggerDropdown, activeFilters[column] || []);
    }
    
    // Update options in body-appended container
    const optionsContainer = $('body > .multi-select-options[data-column="' + column + '"]');
    
    // Update body-appended container highlighting
    if (optionsContainer.length) {
        optionsContainer.find(`.multi-select-option[data-value="${value}"]`).removeClass('selected');
        
        if (activeFilters[column].length === 0) {
            optionsContainer.find('.multi-select-option[data-value=""]').addClass('selected');
        }
    }
});

// Clear all filters
$('#clear-all-filters').on('click', function() {
    activeFilters = {};
    table.search('').columns().search('').draw();
    
    $('.multi-select-option').removeClass('selected');
    $('.multi-select-option[data-value=""]').addClass('selected');
    $('.multi-select-dropdown').each(function() {
        updateDropdownText($(this), []);
    });
    
    $('body > .multi-select-options .multi-select-option').removeClass('selected');
    $('body > .multi-select-options .multi-select-option[data-value=""]').addClass('selected');
    
    updateActiveFiltersDisplay();
});

// Load CSV and initialize DataTable
Papa.parse("data/literature.csv", {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
        $('body > .multi-select-options').remove();
        
        const data = results.data;
        const columns = Object.keys(data[0]).map(key => {
            if (key === "Year") {
                return { 
                    title: key, 
                    data: key, 
                    className: 'dt-left',
                    render: { 
                        _: data => data.toString(), 
                    }
                };
            }
            // Add Google Scholar links for Title column
            if (key === "Title") {
                return {
                    title: key,
                    data: key,
                    render: function (data, type, row) {
                        if (type === 'display') {
                            const htmlParser = document.createElement('textarea');
                            htmlParser.innerHTML = data;
                            const decodedTitle = htmlParser.value;
                            const query = encodeURIComponent(row.Authors + ' ' + decodedTitle);
                            const link = document.createElement('a');

                            link.href = `https://scholar.google.com/scholar?q=${query}`;
                            link.target = "_blank";
                            link.textContent = decodedTitle;
                            return link.outerHTML;
                        }
                        return data;   
                    } 
                }
            }
            return { 
                title: key, 
                data: key 
            };
        });

        // Build table header
        const thead = document.querySelector('#csvTable thead');
        const headerRow = "<tr>" + columns.map(c => `<th>${c.title}</th>`).join('') + "</tr>";
        const filterRow = "<tr>" + columns.map(() => `<th></th>`).join('') + "</tr>";
        thead.innerHTML = headerRow + filterRow;

        // Initialize DataTable
        function processColumn(column, api) {
            const columnTitle = columns[column.index()].title;
            
            // Skip certain columns for filtering
            if (columnTitle === "Title") return;
            if (columnTitle === "Key") return;
            
            // Find filter container
            let container = $(api.table().header())
                .find('tr')
                .eq(1)
                .find('th')
                .eq(column.index());
            
            
            if (!container.length) return;
            
            // Extract unique values
            let allValues = [];
            column.data().each(function (d) {
                if (d !== null && d !== undefined) {
                    const value = d.toString().trim();
                    allValues = allValues.concat(columnTitle === "Year" ? [value] : value.split(/,\s*/));
                }
            });
            
            // Sort values
            if (columnTitle === "Year") {
                allValues = [...new Set(allValues)]
                    .filter(Boolean)
                    .sort((a, b) => Number.parseInt(b) - Number.parseInt(a));
            } else {
                allValues = [...new Set(allValues)]
                    .filter(Boolean)
                    .sort();
            }

            // Create Multi-Select Dropdown with Search-Functionality for all columns except for specified ones
            const columnsWithoutSearch = [
                // All literature surveys
                "Year",
                
                // PL-Surveys
                "Category",

                // PL-Analyses
                "SE Layer",
                "Specification Strategy",
                
                // PL-Sampling
                "Input Data",
                "Algorithm Category",
                "Coverage",
                "Evaluation",
                "Application",
            ];                  
            const shouldShowSearch = !columnsWithoutSearch.includes(columnTitle.trim());
            createMultiSelect(container, allValues, column, shouldShowSearch);
        }
        table = $('#csvTable').DataTable({
            deferRender: false,
            data: data,
            columns: columns,
            orderCellsTop: true,
            autoWidth: false,
            scrollX: true,
            responsive: false,
            scrollCollapse: false,
            pageLength: -1,
            lengthMenu: [[-1, 10, 25, 50, 100], ["All", 10, 25, 50, 100]],
            initComplete: function () {
                const api = this.api();
                
                setTimeout(function() {
                    api.columns().every(function () {
                        processColumn(this, api);
                    });
                }, 100);
            },
            language: {
                search: "Search:",
                lengthMenu: "Show _MENU_ entries",
                info: "Showing _START_ to _END_ of _TOTAL_ entries",
                paginate: {previous: "Previous", next: "Next"},
                zeroRecords: "No matching entries found"
            }
        });
    }
});

// Adjust columns on window resize
let resizeTimer;
$(globalThis).on('resize', function () { 
        if (table) { 
            table.columns.adjust();

            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                table.columns.adjust().draw(false);
            }, 150);
        }
    
});

// Close filter dropdown on mousewheel and touchstart
$(document).on('mousedown touchstart', function(e) {
    if (currentlyOpenDropdown) {
        const dropdownElement = currentlyOpenDropdown[0];

        const isClickInside = dropdownElement.contains(e.target) || 
                          $(e.target).closest('.multi-select-dropdown').length > 0;
        
        if (!isClickInside) {
            currentlyOpenDropdown[0].scrollTop = 0;
            currentlyOpenDropdown.removeClass('show').hide();
            $('body').removeClass('modal-open');
            currentlyOpenDropdown = null;
        }
    }
});

// Close filter dropdown on scroll (vertical / horizontal)
$(globalThis).on('scroll wheel touchmove', function(e) {
    if (!currentlyOpenDropdown) return;
    if (isFilteringInProgress) return;

    // Mobile - specific
    if (window.innerWidth <= 576) return;

    const isScrollInsideDropdown = $(e.target).closest('.multi-select-options').length > 0;

    if (!isScrollInsideDropdown) {
        currentlyOpenDropdown.removeClass('show').hide();
        currentlyOpenDropdown = null;
    }
});