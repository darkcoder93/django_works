// Global variables and constants
let maxSections = 3;
let constantCategories = ['config1', 'config2', 'config3', 'config4', 'config5', 'config6', 'config7'];
let table; // Global table reference
let hasPreviewed = false; // Track if user has previewed current operations

// Initialize the application when document is ready
$(document).ready(function() {
    // Check for success message from previous submission
    if (sessionStorage.getItem('configUpdateSuccess') === 'true') {
        alert('Configs updated successfully!');
        sessionStorage.removeItem('configUpdateSuccess'); // Clear the flag
    }
    
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
        hasPreviewed = false; // Reset preview flag when modal is closed
    });

    // Add section
    $('#addSectionBtn').off('click').on('click', function() {
        let currentSectionCount = $('#operationSections .modal-section').length;
        if (currentSectionCount < maxSections) {
            $('#operationSections').append(createSection());
            updateSectionFields();
            hasPreviewed = false; // Reset preview flag when section is added
        }
    });
    
    // Remove section
    $('#removeSectionBtn').off('click').on('click', function() {
        let currentSectionCount = $('#operationSections .modal-section').length;
        if (currentSectionCount > 1) {
            $('#operationSections .modal-section').last().remove();
            updateSectionFields();
            hasPreviewed = false; // Reset preview flag when section is removed
        }
    });
    
    // Reset button
    $('#resetBtn').off('click').on('click', function() {
        resetSections();
        $('#modalPreviewTableContainer').html('');
        hasPreviewed = false; // Reset preview flag when reset is clicked
    });

    // Preview button
    $('#previewBtn').off('click').on('click', function() {
        let names = $('#recordName').val().split(',').map(n => n.trim()).filter(Boolean);
        if (names.length === 0) {
            alert('No names selected.');
            return;
        }
        
        let operations = collectOperations();
        if (!operations) {
            return; // Validation failed, error already shown
        }
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
                console.log('Container found:', container.length > 0);
                console.log('Container current HTML:', container.html());
                
                // Clear container
                container.empty();
                
                // Ensure container is visible
                container.show();
                
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
                console.log('Container final HTML:', container.html());
                console.log('Container is visible:', container.is(':visible'));
                
                // Mark that preview has been done for current operations
                hasPreviewed = true;
            },
            error: function(xhr, status, error) {
                let errorMessage = 'Error generating preview: ' + error;
                if (xhr.responseJSON && xhr.responseJSON.details) {
                    errorMessage += '\n\nValidation errors:\n' + xhr.responseJSON.details.join('\n');
                }
                alert(errorMessage);
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
        if (!operations) {
            return; // Validation failed, error already shown
        }
        if (operations.length === 0) {
            alert('No operations defined.');
            return;
        }

        // Check if user has previewed the current operations
        if (!hasPreviewed) {
            alert('Please preview the changes before submitting. Click the "Preview" button first.');
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
                hasPreviewed = false; // Reset preview flag
                // Set success message in session storage before reload
                sessionStorage.setItem('configUpdateSuccess', 'true');
                // Reload the page to refresh all data
                window.location.reload();
            },
            error: function(xhr, status, error) {
                let errorMessage = 'Error updating configs: ' + error;
                if (xhr.responseJSON && xhr.responseJSON.details) {
                    errorMessage += '\n\nValidation errors:\n' + xhr.responseJSON.details.join('\n');
                }
                errorMessage += '\n\nPlease try again or contact support if the issue persists.';
                alert(errorMessage);
            }
        });
    });

    // Dynamic event handlers for form elements
    $(document).off('change', '.operation-select').on('change', '.operation-select', function() {
        let section = $(this).closest('.modal-section');
        let category = section.find('.category-select').val();
        let operation = $(this).val();
        
        // Clear value field
        section.find('.value-input').val('');
        
        // Clear key field only if not config1 + append
        if (!(category === 'config1' && operation === 'append')) {
            section.find('.key-input').val('');
        }
        
        updateSectionFields();
        hasPreviewed = false; // Reset preview flag when operation changes
        
        // Clear any existing validation errors
        section.find('.validation-error').remove();
        section.find('.form-control').removeClass('is-invalid');
    });
    
    $(document).off('change', '.category-select').on('change', '.category-select', function() {
        let section = $(this).closest('.modal-section');
        let category = $(this).val();
        let operation = section.find('.operation-select').val();
        
        // Clear value field
        section.find('.value-input').val('');
        
        // Clear key field only if not config1 + append
        if (!(category === 'config1' && operation === 'append')) {
            section.find('.key-input').val('');
        }
        
        updateSectionFields();
        hasPreviewed = false; // Reset preview flag when category changes
        
        // Clear any existing validation errors
        section.find('.validation-error').remove();
        section.find('.form-control').removeClass('is-invalid');
    });
    
    // Reset preview flag when key, value, or case sensitivity changes
    $(document).off('input', '.key-input, .value-input').on('input', '.key-input, .value-input', function() {
        let input = $(this);
        let value = input.val();
        
        // Check for spaces in the input
        if (value.includes(' ')) {
            alert('Spaces are not allowed in this field. The text will be cleared.');
            input.val(''); // Clear the input
            hasPreviewed = false;
            validateSectionInRealTime($(this).closest('.modal-section'));
            return;
        }
        
        hasPreviewed = false; // Reset preview flag when input changes
        validateSectionInRealTime($(this).closest('.modal-section'));
    });
    
    $(document).off('change', '.case-checkbox').on('change', '.case-checkbox', function() {
        hasPreviewed = false; // Reset preview flag when case sensitivity changes
        validateSectionInRealTime($(this).closest('.modal-section'));
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
    return `<div class="col-12 modal-section" style="margin-bottom: 0.5rem;">
        <div class="card" style="padding: 0.75rem;">
            <div style="display: flex; gap: 0.75rem; align-items: end;">
                <div style="flex: 1; min-width: 0;">
                    <label style="display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.875rem;">Category</label>
                    ${catSelect}
                </div>
                <div style="flex: 1; min-width: 0;">
                    <label style="display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.875rem;">Operation</label>
                    <select class="form-select operation-select" name="operation" style="width: 100%;">
                        ${operationOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
                    </select>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <label style="display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.875rem;">Key</label>
                    <input type="text" class="form-control key-input" name="key" style="width: 100%;">
                </div>
                <div style="flex: 1; min-width: 0;">
                    <label style="display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.875rem;">Value</label>
                    <input type="text" class="form-control value-input" name="value" style="width: 100%;">
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-left: 0.5rem;">
                    <input class="form-check-input case-checkbox" type="checkbox" name="case" style="margin: 0;">
                    <label style="margin: 0; font-size: 0.875rem; white-space: nowrap;">Case</label>
                </div>
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
        if (category === 'config1') {
            appendOption.show();
            // For config1, make key read-only and set to "default_key" only when append is selected
            if (op === 'append') {
                $(this).find('.key-input').val('default_key').prop('readonly', true);
                // For append operation, check case sensitivity and make it read-only
                $(this).find('.case-checkbox').prop('checked', true).prop('disabled', true);
            } else {
                $(this).find('.key-input').val('').prop('readonly', false);
                // For other operations, enable case sensitivity checkbox
                $(this).find('.case-checkbox').prop('disabled', false);
            }
        } else {
            appendOption.hide();
            if (op === 'append') {
                $(this).find('.operation-select').val('edit');
            }
            // For other configs, make key editable and enable case sensitivity
            $(this).find('.key-input').prop('readonly', false);
            $(this).find('.case-checkbox').prop('disabled', false);
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

function validateOperation(category, op, key, value, caseSensitive) {
    // Strip whitespace
    key = key.trim();
    value = value.trim();
    
    // Check for empty key
    if (!key) {
        return { isValid: false, error: "Key cannot be empty" };
    }
    
    // Check for invalid characters in key
    if (/[;\s"'\\]/.test(key)) {
        return { isValid: false, error: `Key '${key}' contains invalid characters (spaces, semicolons, quotes, or backslashes)` };
    }
    
    // Check for invalid characters in value (only for edit and append operations)
    if (op !== 'delete' && /[;\s"'\\]/.test(value)) {
        return { isValid: false, error: `Value '${value}' contains invalid characters (spaces, semicolons, quotes, or backslashes)` };
    }
    
    // Check for empty value in edit/append operations
    if (op !== 'delete' && !value) {
        return { isValid: false, error: "Value cannot be empty for edit and append operations" };
    }
    
    return { isValid: true, error: "" };
}

function validateSectionInRealTime(section) {
    let validation = validateOperationSection(section);
    let errorDiv = section.find('.validation-error');
    
    // Remove existing error message
    if (errorDiv.length > 0) {
        errorDiv.remove();
    }
    
    // Remove error styling
    section.find('.form-control').removeClass('is-invalid');
    
    if (!validation.isValid) {
        // Add error styling to inputs
        let keyInput = section.find('.key-input');
        let valueInput = section.find('.value-input');
        
        if (!keyInput.val().trim()) {
            keyInput.addClass('is-invalid');
        }
        if (section.find('.operation-select').val() !== 'delete' && !valueInput.val().trim()) {
            valueInput.addClass('is-invalid');
        }
        
        // Add error message
        let errorHtml = `<div class="validation-error text-danger" style="font-size: 0.75rem; margin-top: 0.25rem;">${validation.error}</div>`;
        section.find('.card').append(errorHtml);
    }
}

function validateOperationSection(section) {
    let category = section.find('.category-select').val();
    let op = section.find('.operation-select').val();
    let key = section.find('.key-input').val().trim();
    let value = section.find('.value-input').val().trim();
    let caseSensitive = section.find('.case-checkbox').is(':checked');
    
    // Basic validation - check if required fields are filled
    if (!key) {
        return { isValid: false, error: "Key is required" };
    }
    
    if (op !== 'delete' && !value) {
        return { isValid: false, error: "Value is required for edit and append operations" };
    }
    
    // Detailed validation
    return validateOperation(category, op, key, value, caseSensitive);
}

function collectOperations() {
    let operations = [];
    let validationErrors = [];
    let removedSections = [];
    
    $('#operationSections .modal-section').each(function(index) {
        let section = $(this);
        let category = section.find('.category-select').val();
        let op = section.find('.operation-select').val();
        let key = section.find('.key-input').val().trim();
        let value = section.find('.value-input').val().trim();
        let caseSensitive = section.find('.case-checkbox').is(':checked');
        
        // Check if this section is completely empty (no key entered)
        if (!key) {
            removedSections.push(index + 1);
            section.remove(); // Remove the empty section from DOM
            return; // Skip this section entirely
        }
        
        // Validate the operation
        let validation = validateOperationSection(section);
        if (!validation.isValid) {
            validationErrors.push(`Section ${index + 1}: ${validation.error}`);
        } else {
            operations.push({ category, op, key, value, caseSensitive });
        }
    });
    
    // Show validation errors if any
    if (validationErrors.length > 0) {
        alert('Validation errors:\n' + validationErrors.join('\n'));
        return null;
    }
    
    // Show message about removed sections
    if (removedSections.length > 0) {
        let message = `Section(s) ${removedSections.join(', ')} were removed because they had no key or value.`;
        if (operations.length === 0) {
            alert('No valid operations found. Please fill in at least one operation section.\n\n' + message);
            return null;
        } else {
            // Show message but continue with valid operations
            alert(message + '\n\nContinuing with the valid operations.');
        }
    }
    
    // Update button visibility after removing sections
    updateButtonVisibility();
    
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