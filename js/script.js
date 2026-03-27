/**
 * Multi-Select Dropdown Filtering for DataTables
 * 
 * This script enhances a DataTable with multi-select dropdown filters for each column.
 * Users can select multiple filter values, and the table updates dynamically to show
 * only the rows that match the selected criteria.
 * 
 * @author Lennart Pape
 * @date 2026-03-26
 * @version 2.1.0
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
            displayText = `${truncatedFirst} (+${remainingCount})`;
        }

        const fullText = filters.join(', ');
        dropdown.find('.dropdown-text')
            .text(displayText)
            .addClass('selected-values')
            .attr('title', fullText);
    }
}

// Reposition dropdown menu relative to the edge of the screen (depending on the available space)
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

    let topPosition = rect.bottom + 2;
    if (rect.bottom + menuHeight > windowHeight) {
        topPosition = rect.top - menuHeight - 2;
    }

    optionsContainer.css({
        'top': topPosition + 'px',
        'left': leftPosition + 'px'
    });
}

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
    
    // Toggle dropdown visibility
    const toggleDropdown = function() {
        $('body > .multi-select-options').not(optionsContainer).removeClass('show').hide();
        $('body').removeClass('modal-open');

        const isVisible = optionsContainer.hasClass('show');
        const isMobile = window.innerWidth <= 576;
        
        if (!isVisible) {

            // Reset search befor reopening dorpdown
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
                repositionDropdown(dropdown, optionsContainer);
            }    
            
            currentlyOpenDropdown = optionsContainer;

            // Set focus on search field when opening dropdown (only in desktop-mode)
            if (showSearch && window.innerWidth > 576) {
                setTimeout(function () {
                    optionsContainer.find('.dropdown-search-input').focus();
                }, 100);
            }
        } else {
            optionsContainer.removeClass('show').hide();
            $('body').removeClass('modal-open');
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
                if (optionsContainer.hasClass('show')) {
                    repositionDropdown(dropdown, optionsContainer);
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
    
    // Reposition on window resize
    $(window).on('resize', function() {
        if (optionsContainer.hasClass('show')) {
            repositionDropdown(dropdown, optionsContainer);
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

                        // Create Multi-Select Dropdown with Search-Functionality for all columns except for specified ones
                        const columnsWithoutSearch = [
                            // All literature surveys
                            "Year",     
                            
                            // PL-Surveys                    
                            "Category",
                            
                            // PL-Analyses                     
                            "SE Layer",      
                            
                            // PL-Sampling               
                            "Input Data",                   
                            "Algorithm Category",           
                            "Coverage",                     
                            "Evaluation",                    
                        ];                  
                        const shouldShowSearch = !columnsWithoutSearch.includes(columnTitle.trim());
                        createMultiSelect(container, allValues, column, shouldShowSearch);
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
$(window).on('resize', function () { 
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
        const container = currentlyOpenDropdown[0];
        const rect = container.getBoundingClientRect();
        
        const clientX = e.clientX || (e.originalEvent && e.originalEvent.touches ? e.originalEvent.touches[0].clientX : 0);
        const clientY = e.clientY || (e.originalEvent && e.originalEvent.touches ? e.originalEvent.touches[0].clientY : 0);

        const isInsideWhiteBox = 
            clientX >= rect.left && 
            clientX <= rect.right && 
            clientY >= rect.top && 
            clientY <= rect.bottom;

        const isClickOnButton = $(e.target).closest('.multi-select-dropdown').length > 0;
        
        if (!isInsideWhiteBox && !isClickOnButton) {
            currentlyOpenDropdown.removeClass('show').hide();
            $('body').removeClass('modal-open');
            currentlyOpenDropdown = null;
        }
    }
});

// Close filter dropdown on scroll (vertical / horizontal)
$(window).on('scroll wheel touchmove', function(e) {
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