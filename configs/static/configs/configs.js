// Global variables and constants
let maxSections = 3;
let constantCategories = ['config1', 'config2', 'config3', 'config4', 'config5', 'config6', 'config7', 'config8'];
let table; // Global table reference

// Initialize the application when document is ready
$(document).ready(function() {
    // Only essential initialization that needs to happen on page load
    initializeDataTable();
    initializeRowSelection();
    updateTable();
});

// Initialize DataTable
function initializeDataTable() {
    table = $('#configTable').DataTable({
        columns: [
            { data: 'name' },
            { data: 'config' }
        ],
        data: [],
        rowCallback: function(row, data) {
            if (!$(row).hasClass('selected')) {
                $(row).removeClass('selected');
            }
        }
    });
}

// Initialize row selection
function initializeRowSelection() {
    $('#configTable tbody').on('click', 'tr', function() {
        $(this).toggleClass('selected');
    });
}

// Main function called when modal button is clicked
function initializeModal() {
    let selectedRows = table.rows('.selected').data().toArray();
    if (selectedRows.length === 0) {
        alert('Please select at least one row in the table.');
        return;
    }
    
    let names = selectedRows.map(row => row.name).join(', ');
    $('#recordName').val(names);
    resetSections();
    setupModalEventHandlers();
    $('#configModal').modal('show');
}

// Setup all modal event handlers
function setupModalEventHandlers() {
    // Modal close - reset all data
    $('#configModal').off('hidden.bs.modal').on('hidden.bs.modal', function() {
        resetSections();
        $('#recordName').val('');
        $('#modalPreviewTableContainer').html('');
        $('#configForm input[type="text"]').val('');
        $('#configForm input[type="checkbox"]').prop('checked', false);
        $('#configForm select').prop('selectedIndex', 0);
    });

    // Add section
    $('#addSectionBtn').off('click').on('click', function() {
        let currentSectionCount = $('#operationSections .modal-section').length;
        if (currentSectionCount < maxSections) {
            $('#operationSections').append(createSection());
            updateSectionFields();
        }
    });
    
    // Remove section
    $('#removeSectionBtn').off('click').on('click', function() {
        let currentSectionCount = $('#operationSections .modal-section').length;
        if (currentSectionCount > 1) {
            $('#operationSections .modal-section').last().remove();
            updateSectionFields();
        }
    });
    
    // Reset button
    $('#resetBtn').off('click').on('click', function() {
        resetSections();
        $('#modalPreviewTableContainer').html('');
    });

    // Preview button
    $('#previewBtn').off('click').on('click', function() {
        let names = $('#recordName').val().split(',').map(n => n.trim()).filter(Boolean);
        if (names.length === 0) {
            alert('No names selected.');
            return;
        }
        
        let operations = collectOperations();
        if (operations.length === 0) {
            alert('No operations defined.');
            return;
        }

        $.ajax({
            url: '/api/preview/',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ names, operations }),
            success: function(data) {
                let previewRows = data.preview_rows;
                let container = $('#modalPreviewTableContainer');
                
                console.log('Preview data received:', data);
                
                // Clear container
                container.empty();
                
                // Add note section
                container.append('<div class="mb-2"><strong>Note:</strong> <span class="added">Added</span> (green), <span class="appended">Appended</span> (pink), <span class="edited">Edited</span> (orange)</div>');
                
                // Create table
                let table = $('<table class="table table-bordered table-sm" style="margin-bottom: 0; font-size: 0.875rem;"></table>');
                let thead = $('<thead><tr><th style="width: 15%; padding: 0.5rem; word-wrap: break-word; max-width: 150px;">Name</th><th style="width: 42.5%; padding: 0.5rem; word-wrap: break-word; max-width: 300px;">Old Config</th><th style="width: 42.5%; padding: 0.5rem; word-wrap: break-word; max-width: 300px;">New Config (Preview)</th></tr></thead>');
                let tbody = $('<tbody></tbody>');
                
                // Add rows
                previewRows.forEach(function(row) {
                    let tr = $('<tr></tr>');
                    tr.append('<td style="vertical-align: top; padding: 0.5rem; word-wrap: break-word; max-width: 150px; white-space: pre-wrap; overflow-wrap: break-word;">' + row.name + '</td>');
                    tr.append('<td style="vertical-align: top; padding: 0.5rem; word-wrap: break-word; max-width: 300px; white-space: pre-wrap; overflow-wrap: break-word;">' + row.old_config + '</td>');
                    tr.append('<td style="vertical-align: top; padding: 0.5rem; word-wrap: break-word; max-width: 300px; white-space: pre-wrap; overflow-wrap: break-word;">' + row.new_config + '</td>'); // HTML color coding should work now
                    tbody.append(tr);
                });
                
                table.append(thead).append(tbody);
                container.append(table);
                
                console.log('Table HTML created:', container.html());
            },
            error: function(xhr, status, error) {
                alert('Error generating preview: ' + error);
            }
        });
    });

    // Submit button
    $('#submitBtn').off('click').on('click', function() {
        let names = $('#recordName').val().split(',').map(n => n.trim()).filter(Boolean);
        if (names.length === 0) {
            alert('No names selected.');
            return;
        }
        
        let operations = collectOperations();
        if (operations.length === 0) {
            alert('No operations defined.');
            return;
        }

        $.ajax({
            url: '/api/update/',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ names, operations }),
            success: function(data) {
                $('#configModal').modal('hide');
                $('#modalPreviewTableContainer').html('');
                updateTable();
                alert('Configs updated successfully!');
            },
            error: function(xhr, status, error) {
                alert('Error updating configs: ' + error);
            }
        });
    });

    // Dynamic event handlers for form elements
    $(document).off('change', '.operation-select').on('change', '.operation-select', function() {
        updateSectionFields();
    });
    
    $(document).off('change', '.category-select').on('change', '.category-select', function() {
        updateSectionFields();
    });
}

function createSection() {
    let operationOptions = [
        { value: 'edit', label: 'Edit' },
        { value: 'append', label: 'Append' },
        { value: 'delete', label: 'Delete' }
    ];
    
    let catSelect = '<select class="form-select category-select" name="category">';
    constantCategories.forEach(function(cat) {
        catSelect += `<option value="${cat}">${cat}</option>`;
    });
    catSelect += '</select>';
    return `<div class="col-md-4 modal-section">
        <div class="card p-2">
            <div class="mb-2">
                <label>Category</label>
                ${catSelect}
            </div>
            <div class="mb-2">
                <label>Operation</label>
                <select class="form-select operation-select" name="operation">
                    ${operationOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
                </select>
            </div>
            <div class="mb-2 key-value-group">
                <label>Key</label>
                <input type="text" class="form-control key-input" name="key">
            </div>
            <div class="mb-2 value-group">
                <label>Value</label>
                <input type="text" class="form-control value-input" name="value">
            </div>
            <div class="form-check">
                <input class="form-check-input case-checkbox" type="checkbox" name="case">
                <label class="form-check-label">Case Sensitive</label>
            </div>
        </div>
    </div>`;
}

function resetSections() {
    $('#operationSections').empty();
    $('#operationSections').append(createSection());
    updateSectionFields();
}

function updateSectionFields() {
    $('#operationSections .modal-section').each(function() {
        let op = $(this).find('.operation-select').val();
        let category = $(this).find('.category-select').val();
        
        if (op === 'delete') {
            $(this).find('.value-group').hide();
        } else {
            $(this).find('.value-group').show();
        }
        
        let appendOption = $(this).find('.operation-select option[value="append"]');
        if (category === 'config8') {
            appendOption.show();
        } else {
            appendOption.hide();
            if (op === 'append') {
                $(this).find('.operation-select').val('edit');
            }
        }
    });
    
    updateButtonVisibility();
}

function updateButtonVisibility() {
    let currentSectionCount = $('#operationSections .modal-section').length;
    
    if (currentSectionCount >= maxSections) {
        $('#addSectionBtn').hide();
    } else {
        $('#addSectionBtn').show();
    }
    
    if (currentSectionCount <= 1) {
        $('#removeSectionBtn').hide();
    } else {
        $('#removeSectionBtn').show();
    }
}

function collectOperations() {
    let operations = [];
    $('#operationSections .modal-section').each(function() {
        let category = $(this).find('.category-select').val();
        let op = $(this).find('.operation-select').val();
        let key = $(this).find('.key-input').val();
        let value = $(this).find('.value-input').val();
        let caseSensitive = $(this).find('.case-checkbox').is(':checked');
        operations.push({ category, op, key, value, caseSensitive });
    });
    return operations;
}

function updateTable() {
    $.get('/api/configs/', function(resp) {
        let data = resp.data.map(rec => {
            return {
                name: rec.name,
                config: rec.config
            };
        });
        table.clear().rows.add(data).draw();
    });
} 