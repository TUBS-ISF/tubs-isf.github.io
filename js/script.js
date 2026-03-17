/**
 * Multi-Select Dropdown Filtering for DataTables
 * 
 * This script enhances a DataTable with multi-select dropdown filters for each column.
 * Users can select multiple filter values, and the table updates dynamically to show
 * only the rows that match the selected criteria.
 * 
 * @author Lennart Pape
 * @date 2026-01-04
 * @version 1.1.0
 * @requires jQuery, DataTables, PapaParse, Bootstrap
 */

// Global state
let activeFilters = {};
let table;
let currentlyOpenDropdown = null;
let isFilteringInProgress = false;

// Update dropdown display text based on selected filters
function updateDropdownText(dropdown, filters) {
    if (filters.length === 0) {
        dropdown.find('.dropdown-text').text('All').removeClass('selected-values').removeAttr('title');
    } else {
        const firstValue = filters[0];
        const remainingCount = filters.length - 1;
        const maxLengthOneFilter = 20;
        const maxLengthMoreFilters = 3;

        let displayText;

        if (remainingCount === 0) {
            if (firstValue.length > maxLengthOneFilter) {
                displayText = firstValue.substring(0, maxLengthOneFilter) + '...';
            } else {
                displayText = firstValue;
            }
        } else {
            let truncatedFirst = firstValue.substring(0, maxLengthMoreFilters) + '...';
            displayText = `${truncatedFirst} (+${remainingCount} more)`;
        }

        const fullText = filters.join(', ');
        dropdown.find('.dropdown-text')
            .text(displayText)
            .addClass('selected-values')
            .attr('title', fullText);
    }
}

// Create multi-select dropdown for column filtering
function createMultiSelect(container, options, column) {
    const multiSelect = $('<div class="multi-select">');
    const dropdown = $('<div class="multi-select-dropdown"><span class="dropdown-text">All</span></div>');
    const optionsContainer = $('<div class="multi-select-options">');
    
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
        optionsContainer.append(optionDiv);
    });
    
    multiSelect.append(dropdown);
    
    // Toggle dropdown visibility
    const toggleDropdown = function() {
        $('body > .multi-select-options').not(optionsContainer).removeClass('show').hide();
        const isVisible = optionsContainer.hasClass('show');
        
        if (!isVisible) {
            const rect = dropdown[0].getBoundingClientRect();
            const containerWidth = dropdown.outerWidth();
            
            optionsContainer.css({
                'top': (rect.bottom + 2) + 'px',
                'left': rect.left + 'px',
                'width': containerWidth + 'px'
            }).addClass('show');
            
            currentlyOpenDropdown = optionsContainer;
        } else {
            optionsContainer.removeClass('show').hide();
            currentlyOpenDropdown = null;
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
            dropdown.find('.dropdown-text').text('All').removeClass('selected-values');

            isFilteringInProgress = true;
            applyFilters();
            updateActiveFiltersDisplay();
            isFilteringInProgress = false;
            
            optionsContainer.removeClass('show');
            currentlyOpenDropdown = null;
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
            isFilteringInProgress = false;
            
            // Reposition after table redraw
            setTimeout(function() {
                if (optionsContainer.hasClass('show')) {
                    const rect = dropdown[0].getBoundingClientRect();
                    optionsContainer.css({
                        'top': (rect.bottom + 2) + 'px',
                        'left': rect.left + 'px'
                    });
                }
            }, 50);
        }
    });
    
    // Helper: Check if click is outside dropdown
    const isOutsideDropdown = function(e) {
        const clickedDropdown = $(e.target).closest('.multi-select-dropdown[data-dropdown-id="' + uniqueId + '"]').length > 0;
        const clickedOptions = $(e.target).closest('.multi-select-options[data-dropdown-id="' + uniqueId + '"]').length > 0;
        return !clickedDropdown && !clickedOptions;
    };
    
    // Helper: Close dropdown
    const closeDropdown = function() {
        optionsContainer.removeClass('show');
        if (currentlyOpenDropdown === optionsContainer) {
            currentlyOpenDropdown = null;
        }
    };
    
    // Close on outside click
    $(document).on('click mousedown', function(e) {
        if (isOutsideDropdown(e)) {
            closeDropdown();
        }
    });
    
    // Close on scroll
    $('.dataTables_scrollBody').on('scroll', function() {
        if (!isFilteringInProgress) {
            closeDropdown();
        }
    });
    
    $(window).on('scroll', function() {
        if (!isFilteringInProgress) {
            closeDropdown();
        }
    });
    
    $(document).on('wheel mousewheel', function(e) {
        if (!isFilteringInProgress && isOutsideDropdown(e)) {
            closeDropdown();
        }
    });
    
    // Reposition on window resize
    $(window).on('resize', function() {
        if (optionsContainer.hasClass('show')) {
            const rect = dropdown[0].getBoundingClientRect();
            const containerWidth = dropdown.outerWidth();
            optionsContainer.css({
                'top': (rect.bottom + 2) + 'px',
                'left': rect.left + 'px',
                'width': containerWidth + 'px'
            });
        }
    });
    
    container.empty().append(multiSelect);
    $('body').append(optionsContainer);
}

// Apply filters to table columns
function applyFilters() {
    table.columns().every(function() {
        const column = this;
        const columnTitle = column.header().textContent;
        const filters = activeFilters[columnTitle] || [];
        
        if (filters.length === 0) {
            column.search('', true, false);
        } else {
            if (columnTitle === "Year") {
                // Exact match for Year column
                const pattern = '^(' + filters
                .map(f => $.fn.dataTable.util.escapeRegex(f.toString()))
                .join('|') + ')$';
                column.search(pattern, true, false);
            } else {
                // Word boundaries only for alphanumeric values, otherwise match anywhere
                const pattern = '(' + filters
                .map(f => { 
                    const escaped = $.fn.dataTable.util.escapeRegex(f);
                    const startsWithWord = /^\w/.test(f);
                    const endsWithWord = /\w$/.test(f);
                    
                    return (startsWithWord ? '\\b' : '') + escaped + (endsWithWord ? '\\b' : '');
                })
                .join('|') + ')';
                column.search(pattern, true, false);
            }
        }
    });
    table.draw();
}

// Update active filters display
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
    
    // Find and update the correct header dropdown
    let targetHeader = null;
    $('#csvTable thead tr:first th').each(function() {
        if ($(this).text().trim() === column) {
            const columnIndex = $(this).index();
            targetHeader = $('.dataTables_scrollHead thead tr:nth-child(2) th').eq(columnIndex);
            if (!targetHeader.length) {
                targetHeader = $('#csvTable thead tr:nth-child(2) th').eq(columnIndex);
            }
        }
    });
    
    // Update options in body-appended container
    const optionsContainer = $('body > .multi-select-options[data-column="' + column + '"]');
    
    if (targetHeader && targetHeader.length) {
        targetHeader.find(`.multi-select-option[data-value="${value}"]`).removeClass('selected');
        
        if (activeFilters[column].length === 0) {
            targetHeader.find('.multi-select-option[data-value=""]').addClass('selected');
        }
        updateDropdownText(targetHeader, activeFilters[column]);
    }
    
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
    $('.dropdown-text').text('All').removeClass('selected-values').removeAttr('title');
    
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
                            const query = encodeURIComponent(row.Authors + ' ' + data);
                            const escaped = $('<div>').text(data).html();
                            return `<a href="https://scholar.google.com/scholar?q=${query}"
                                target="_blank">${escaped}</a>`;
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
        table = $('#csvTable').DataTable({
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
                        const column = this;
                        const columnTitle = columns[column.index()].title;
                        
                        // Skip certain columns for filtering
                        if (columnTitle === "Title") return;
                        if (columnTitle === "Key") return;
                        
                        // Find filter container
                        let container = $('.dataTables_scrollHead thead tr')
                            .eq(1)
                            .find('th')
                            .eq(column.index());
                        
                        if (!container.length) {
                            container = $('#csvTable thead tr')
                                .eq(1)
                                .find('th')
                                .eq(column.index());
                        }
                        
                        if (!container.length) return;
                        
                        // Extract unique values
                        let allValues = [];
                        column.data().each(function (d) {
                            if (d !== null && d !== undefined) {
                                const value = d.toString().trim();
                                allValues = allValues.concat(columnTitle === "Year" ? [value] : value.split(/[,]\s*/));
                            }
                        });
                        
                        // Sort values
                        if (columnTitle === "Year") {
                            allValues = [...new Set(allValues)]
                                .filter(val => val)
                                .sort((a, b) => parseInt(b) - parseInt(a));
                        } else {
                            allValues = [...new Set(allValues)]
                                .filter(val => val)
                                .sort();
                        }

                        createMultiSelect(container, allValues, column);
                    });
                }, 100);
            },
            language: {
                search: "Search:",
                lengthMenu: "Show _MENU_ entries",
                info: "Showing _START_ to _END_ of _TOTAL_ entries",
                paginate: { previous: "Previous", next: "Next" },
                zeroRecords: "No matching entries found"
            }
        });
        
        // Scroll to top on table redraw
        table.on('draw', function() {
            $('html, body').animate({
                scrollTop: 0
            }, 10);
        });
    }
});

// Adjust columns on window resize
$(window).on('resize', function () {
    if (table) table.columns.adjust();
});