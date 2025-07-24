$(document).ready(function() {
    let sectionCount = 1;
    let maxSections = 3;
    let operationOptions = [
        { value: 'edit', label: 'Edit' },
        { value: 'append', label: 'Append' },
        { value: 'delete', label: 'Delete' }
    ];

    // Constant list of categories
    let constantCategories = ['config1', 'config2', 'config3', 'config4', 'config5', 'config6', 'config7', 'config8'];

    function createSection(idx) {
        let catSelect = '<select class="form-select category-select" name="category' + idx + '">';
        constantCategories.forEach(function(cat) {
            catSelect += `<option value="${cat}">${cat}</option>`;
        });
        catSelect += '</select>';
        return `<div class="col-md-4 modal-section" data-section="${idx}">
            <div class="card p-2">
                <div class="mb-2">
                    <label>Category</label>
                    ${catSelect}
                </div>
                <div class="mb-2">
                    <label>Operation</label>
                    <select class="form-select operation-select" name="operation${idx}">
                        ${operationOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
                    </select>
                </div>
                <div class="mb-2 key-value-group">
                    <label>Key</label>
                    <input type="text" class="form-control key-input" name="key${idx}">
                </div>
                <div class="mb-2 value-group">
                    <label>Value</label>
                    <input type="text" class="form-control value-input" name="value${idx}">
                </div>
                <div class="form-check">
                    <input class="form-check-input case-checkbox" type="checkbox" name="case${idx}" id="case${idx}">
                    <label class="form-check-label" for="case${idx}">Case Sensitive</label>
                </div>
            </div>
        </div>`;
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
            
            // Show append option only for config8
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
        
        // Update button visibility based on section count
        updateButtonVisibility();
    }

    function updateButtonVisibility() {
        // Hide + button when max sections reached
        if (sectionCount >= maxSections) {
            $('#addSectionBtn').hide();
        } else {
            $('#addSectionBtn').show();
        }
        
        // Hide - button when only 1 section remains
        if (sectionCount <= 1) {
            $('#removeSectionBtn').hide();
        } else {
            $('#removeSectionBtn').show();
        }
    }

    let currentCategories = [];

    function resetSections() {
        $('#operationSections').empty();
        sectionCount = 1;
        $('#operationSections').append(createSection(1));
        updateSectionFields();
    }

    // Enable row selection in DataTable
    $('#configTable tbody').on('click', 'tr', function() {
        $(this).toggleClass('selected');
    });

    // Add category select to modal
    function updateCategorySelect(categories) {
        let selectHtml = '<div class="mb-3"><label for="categorySelect" class="form-label">Category</label><select class="form-select" id="categorySelect">';
        categories.forEach(function(cat) {
            selectHtml += `<option value="${cat}">${cat}</option>`;
        });
        selectHtml += '</select></div>';
        if ($('#categorySelect').length) {
            $('#categorySelect').parent().replaceWith(selectHtml);
        } else {
            $('#recordName').parent().after(selectHtml);
        }
    }

    // Modal open
    $('#openModalBtn').on('click', function() {
        let selectedRows = table.rows('.selected').data().toArray();
        if (selectedRows.length === 0) {
            alert('Please select at least one row in the table.');
            return;
        }
        let names = selectedRows.map(row => row.name).join(', ');
        $('#recordName').val(names);
        resetSections();
        $('#configModal').modal('show');
    });

    // Modal close - reset all data
    $('#configModal').on('hidden.bs.modal', function() {
        resetSections();
        $('#recordName').val('');
        $('#modalPreviewTableContainer').html('');
        // Clear all form inputs
        $('#configForm input[type="text"]').val('');
        $('#configForm input[type="checkbox"]').prop('checked', false);
        $('#configForm select').prop('selectedIndex', 0);
    });

    // Add section
    $('#addSectionBtn').on('click', function() {
        if (sectionCount < maxSections) {
            sectionCount++;
            $('#operationSections').append(createSection(sectionCount));
            updateSectionFields();
        }
    });
    // Remove section
    $('#removeSectionBtn').on('click', function() {
        if (sectionCount > 1) {
            $('#operationSections .modal-section').last().remove();
            sectionCount--;
            updateSectionFields();
        }
    });
    // Change operation
    $(document).on('change', '.operation-select', function() {
        updateSectionFields();
    });
    // Change category
    $(document).on('change', '.category-select', function() {
        updateSectionFields();
    });

    // Reset button
    $('#resetBtn').on('click', function() {
        resetSections();
        // Do not clear the names
        $('#modalPreviewTableContainer').html('');
    });

    // Main datatable with only Name and Config columns
    let table = $('#configTable').DataTable({
        columns: [
            { data: 'name' },
            { data: 'config' }
        ],
        data: [],
        rowCallback: function(row, data) {
            // Remove selection if table is redrawn
            if (!$(row).hasClass('selected')) {
                $(row).removeClass('selected');
            }
        }
    });

    function updateTable() {
        $.get('/api/configs/', function(resp) {
            let data = resp.data.map(rec => {
                return {
                    name: rec.name,
                    config: rec.config // use the flattened config string
                };
            });
            table.clear().rows.add(data).draw();
        });
    }

    // Collect operations from all sections
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

    // Preview button logic
    $('#previewBtn').on('click', function() {
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

        // Send to Django for preview
        $.ajax({
            url: '/api/preview/',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ names, operations }),
            success: function(data) {
                let previewRows = data.preview_rows;
                let html = '<div class="mb-2"><strong>Note:</strong> <span class="added">Added</span> (green), <span class="appended">Appended</span> (pink), <span class="edited">Edited</span> (orange)</div>';
                html += '<table class="table table-bordered"><thead><tr><th>Name</th><th>Category</th><th>Old Config</th><th>New Config (Preview)</th></tr></thead><tbody>';
                previewRows.forEach(function(row) {
                    html += `<tr><td>${row.name}</td><td>${row.category}</td><td>${row.old_config}</td><td>${row.new_config}</td></tr>`;
                });
                html += '</tbody></table>';
                $('#modalPreviewTableContainer').html(html);
            },
            error: function(xhr, status, error) {
                alert('Error generating preview: ' + error);
            }
        });
    });

    // Submit button
    $('#submitBtn').on('click', function() {
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

        // Send to Django for update
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

    // Initial table load
    updateTable();
}); 