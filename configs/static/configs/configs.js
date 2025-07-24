$(document).ready(function() {
    let sectionCount = 1;
    let maxSections = 3;
    let operationOptions = [
        { value: 'add', label: 'Add' },
        { value: 'edit', label: 'Edit' },
        { value: 'append', label: 'Append' },
        { value: 'delete', label: 'Delete' }
    ];

    function createSection(idx, categories) {
        let catSelect = '<select class="form-select category-select" name="category' + idx + '">';
        categories.forEach(function(cat) {
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
            if (op === 'delete') {
                $(this).find('.value-group').hide();
            } else {
                $(this).find('.value-group').show();
            }
        });
    }

    let currentCategories = [];

    function resetSections() {
        $('#operationSections').empty();
        sectionCount = 1;
        $('#operationSections').append(createSection(1, currentCategories));
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
        // Get categories from first selected row (assume all have same structure)
        $.get('/api/configs/', function(resp) {
            let rec = resp.data.find(r => r.name === selectedRows[0].name);
            let categories = rec && rec.raw_config ? Object.keys(rec.raw_config) : [];
            currentCategories = categories;
            resetSections();
            $('#configModal').modal('show');
        });
    });

    // Add section
    $('#addSectionBtn').on('click', function() {
        if (sectionCount < maxSections) {
            sectionCount++;
            $('#operationSections').append(createSection(sectionCount, currentCategories));
            updateSectionFields();
        }
    });
    // Remove section
    $('#removeSectionBtn').on('click', function() {
        if (sectionCount > 1) {
            $('#operationSections .modal-section').last().remove();
            sectionCount--;
        }
    });
    // Change operation
    $(document).on('change', '.operation-select', function() {
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

    // Color diff function for preview
    function colorDiff(oldStr, newStr) {
        let oldPairs = (oldStr || '').split(';').filter(Boolean).map(s => s.trim());
        let newPairs = (newStr || '').split(';').filter(Boolean).map(s => s.trim());
        let oldMap = {};
        oldPairs.forEach(p => { let [k, v] = p.split(' '); oldMap[k] = v; });
        let newMap = {};
        newPairs.forEach(p => { let [k, v] = p.split(' '); newMap[k] = v; });
        let html = '';
        for (let k in newMap) {
            if (!(k in oldMap)) {
                html += `<span class="added">${k} ${newMap[k]}</span>;`;
            } else if (oldMap[k] !== newMap[k]) {
                html += `<span class="edited">${k} ${newMap[k]}</span>;`;
            } else {
                html += `${k} ${newMap[k]};`;
            }
        }
        for (let k in oldMap) {
            if (!(k in newMap)) {
                html += `<span class="appended">${k} ${oldMap[k]}</span>;`;
            }
        }
        return html;
    }

    // Preview button logic
    $('#previewBtn').on('click', function() {
        let names = $('#recordName').val().split(',').map(n => n.trim()).filter(Boolean);
        if (names.length === 0) {
            alert('No names selected.');
            return;
        }
        let operations = [];
        $('#operationSections .modal-section').each(function() {
            let category = $(this).find('.category-select').val();
            let op = $(this).find('.operation-select').val();
            let key = $(this).find('.key-input').val();
            let value = $(this).find('.value-input').val();
            let caseSensitive = $(this).find('.case-checkbox').is(':checked');
            operations.push({ category, op, key, value, caseSensitive });
        });
        $.get('/api/configs/', function(resp) {
            let previewRows = [];
            names.forEach(function(name) {
                let rec = resp.data.find(r => r.name === name);
                let raw_config = rec && rec.raw_config ? rec.raw_config : {};
                operations.forEach(function(operation) {
                    let { category, op, key, value, caseSensitive } = operation;
                    let oldConfig = raw_config[category] || '';
                    let pairs = oldConfig ? oldConfig.split(';').filter(Boolean).map(s => s.trim().split(' ')) : [];
                    let newPairs = pairs.map(pair => [...pair]); // deep copy
                    if (op === 'add') {
                        if (!newPairs.some(([k]) => (caseSensitive ? k === key : k.toLowerCase() === key.toLowerCase()))) {
                            newPairs.push([key, value]);
                        }
                    } else if (op === 'edit') {
                        newPairs = newPairs.map(([k, v]) => {
                            if (caseSensitive ? k === key : k.toLowerCase() === key.toLowerCase()) {
                                return [k, value];
                            }
                            return [k, v];
                        });
                    } else if (op === 'append') {
                        newPairs.push([key, value]);
                    } else if (op === 'delete') {
                        newPairs = newPairs.filter(([k]) => !(caseSensitive ? k === key : k.toLowerCase() === key.toLowerCase()));
                    }
                    let newConfig = newPairs.map(([k, v]) => k + ' ' + v).join(';');
                    previewRows.push({
                        name: name,
                        category: category,
                        old_config: oldConfig,
                        new_config: colorDiff(oldConfig, newConfig)
                    });
                });
            });
            let html = '<table class="table table-bordered"><thead><tr><th>Name</th><th>Category</th><th>Old Config</th><th>New Config (Preview)</th></tr></thead><tbody>';
            previewRows.forEach(function(row) {
                html += `<tr><td>${row.name}</td><td>${row.category}</td><td>${row.old_config}</td><td>${row.new_config}</td></tr>`;
            });
            html += '</tbody></table>';
            $('#modalPreviewTableContainer').html(html);
        });
    });

    // Submit button (require preview first for clarity)
    $('#submitBtn').on('click', function() {
        let names = $('#recordName').val().split(',').map(n => n.trim()).filter(Boolean);
        if (names.length === 0) {
            alert('No names selected.');
            return;
        }
        let operations = [];
        $('#operationSections .modal-section').each(function() {
            let category = $(this).find('.category-select').val();
            let op = $(this).find('.operation-select').val();
            let key = $(this).find('.key-input').val();
            let value = $(this).find('.value-input').val();
            let caseSensitive = $(this).find('.case-checkbox').is(':checked');
            operations.push({ category, op, key, value, caseSensitive });
        });
        names.forEach(function(name) {
            $.get('/api/configs/', function(resp) {
                let rec = resp.data.find(r => r.name === name);
                let oldConfig = rec ? rec.raw_config : {};
                let newConfig = { ...oldConfig };
                operations.forEach(function(operation) {
                    let { category, op, key, value, caseSensitive } = operation;
                    let configStr = newConfig[category] || '';
                    let pairs = configStr ? configStr.split(';').filter(Boolean).map(s => s.trim().split(' ')) : [];
                    if (op === 'add') {
                        // If category does not exist, create it and add the key-value pair
                        if (!newConfig[category]) {
                            newConfig[category] = key + ' ' + value;
                            return;
                        }
                        if (!pairs.some(([k]) => (caseSensitive ? k === key : k.toLowerCase() === key.toLowerCase()))) {
                            pairs.push([key, value]);
                        }
                    } else if (op === 'edit') {
                        pairs = pairs.map(([k, v]) => {
                            if (caseSensitive ? k === key : k.toLowerCase() === key.toLowerCase()) {
                                return [k, value];
                            }
                            return [k, v];
                        });
                    } else if (op === 'append') {
                        pairs.push([key, value]);
                    } else if (op === 'delete') {
                        pairs = pairs.filter(([k]) => !(caseSensitive ? k === key : k.toLowerCase() === key.toLowerCase()));
                    }
                    newConfig[category] = pairs.map(([k, v]) => k + ' ' + v).join(';');
                });
                // Submit to backend
                $.ajax({
                    url: '/api/update/',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ name, new_config: newConfig }),
                    success: function(data) {
                        updateTable();
                    }
                });
            });
        });
        $('#configModal').modal('hide');
        $('#modalPreviewTableContainer').html('');
    });

    // Initial table load
    updateTable();
}); 