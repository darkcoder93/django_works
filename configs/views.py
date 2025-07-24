from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import ConfigRecord
import json


def index(request):
    return render(request, 'configs/index.html')


def api_get_configs(request):
    records = ConfigRecord.objects.all()
    data = []
    for rec in records:
        # Flatten categories for display: show as 'category1: ...; category2: ...'
        config_str = '; '.join([f"{cat}: {val}" for cat, val in rec.config.items()])
        data.append({
            'name': rec.name,
            'config': config_str,
            'raw_config': rec.config  # for modal preview
        })
    return JsonResponse({'data': data})


# Helper: Converts a config string to a key-value object
def parse_config_string(config_str):
    obj = {}
    if config_str:
        for pair in config_str.split(';'):
            pair = pair.strip()
            if pair:
                parts = pair.split(' ', 1)
                if len(parts) == 2:
                    k, v = parts
                    obj[k] = v
    return obj


# Helper: Converts a key-value object to a config string
def stringify_config_object(obj):
    return ';'.join([f"{k} {v}" for k, v in obj.items()])


# Helper: Apply operations to config objects
def apply_operations_to_config(config_obj, operations):
    new_obj = config_obj.copy()
    for operation in operations:
        category = operation['category']
        op = operation['op']
        key = operation['key']
        value = operation['value']
        case_sensitive = operation['caseSensitive']
        
        if op == 'edit':
            # Edit: Replace value if key exists, add if key doesn't exist
            if case_sensitive:
                if key in new_obj:
                    new_obj[key] = value
                else:
                    new_obj[key] = value
            else:
                # Case insensitive: find existing key and replace, or add new
                existing_key = None
                for k in new_obj.keys():
                    if k.lower() == key.lower():
                        existing_key = k
                        break
                if existing_key:
                    new_obj[existing_key] = value
                else:
                    new_obj[key] = value
                    
        elif op == 'append':
            # Append: If key exists, add at end of existing value. If not, add new key
            if case_sensitive:
                if key in new_obj:
                    # Append to existing value
                    new_obj[key] = new_obj[key] + ' ' + value
                else:
                    # Add new key
                    new_obj[key] = value
            else:
                # Case insensitive: find existing key and append, or add new
                existing_key = None
                for k in new_obj.keys():
                    if k.lower() == key.lower():
                        existing_key = k
                        break
                if existing_key:
                    # Append to existing value
                    new_obj[existing_key] = new_obj[existing_key] + ' ' + value
                else:
                    # Add new key
                    new_obj[key] = value
                    
        elif op == 'delete':
            if case_sensitive:
                if key in new_obj:
                    del new_obj[key]
            else:
                # Case insensitive delete
                for k in list(new_obj.keys()):
                    if k.lower() == key.lower():
                        del new_obj[k]
    return new_obj


# Helper: Generate color-coded diff
def color_diff(old_str, new_str):
    old_obj = parse_config_string(old_str)
    new_obj = parse_config_string(new_str)
    
    html_parts = []
    for k, v in new_obj.items():
        if k not in old_obj:
            html_parts.append(f'<span class="added">{k} {v}</span>')
        elif old_obj[k] != v:
            html_parts.append(f'<span class="edited">{k} {v}</span>')
        else:
            html_parts.append(f'{k} {v}')
    
    for k, v in old_obj.items():
        if k not in new_obj:
            html_parts.append(f'<span class="appended">{k} {v}</span>')
    
    return ';'.join(html_parts)


@csrf_exempt
def api_preview_configs(request):
    if request.method == 'POST':
        body = json.loads(request.body)
        names = body.get('names', [])
        operations = body.get('operations', [])
        
        preview_rows = []
        
        for name in names:
            try:
                rec = ConfigRecord.objects.get(name=name)
                raw_config = rec.config
            except ConfigRecord.DoesNotExist:
                raw_config = {}
            
            for operation in operations:
                category = operation['category']
                old_config_str = raw_config.get(category, '')
                old_config_obj = parse_config_string(old_config_str)
                
                # Apply operations to this category only
                category_operations = [op for op in operations if op['category'] == category]
                new_config_obj = apply_operations_to_config(old_config_obj, category_operations)
                
                new_config_str = stringify_config_object(new_config_obj)
                
                preview_rows.append({
                    'name': name,
                    'category': category,
                    'old_config': old_config_str,
                    'new_config': color_diff(old_config_str, new_config_str)
                })
        
        return JsonResponse({'preview_rows': preview_rows})
    
    return JsonResponse({'error': 'Invalid request'}, status=400)


@csrf_exempt
def api_update_configs(request):
    if request.method == 'POST':
        body = json.loads(request.body)
        names = body.get('names', [])
        operations = body.get('operations', [])
        
        results = []
        
        for name in names:
            try:
                rec = ConfigRecord.objects.get(name=name)
                old_config = rec.config.copy()
            except ConfigRecord.DoesNotExist:
                rec = ConfigRecord.objects.create(name=name, config={})
                old_config = {}
            
            new_config = old_config.copy()
            
            # Group operations by category
            category_operations = {}
            for op in operations:
                category = op['category']
                if category not in category_operations:
                    category_operations[category] = []
                category_operations[category].append(op)
            
            # Apply operations to each category
            for category, ops in category_operations.items():
                old_config_str = new_config.get(category, '')
                old_config_obj = parse_config_string(old_config_str)
                
                if not new_config.get(category) and any(op['op'] == 'add' for op in ops):
                    # Create new category for add operation
                    add_op = next(op for op in ops if op['op'] == 'add')
                    new_config[category] = stringify_config_object({add_op['key']: add_op['value']})
                else:
                    new_config_obj = apply_operations_to_config(old_config_obj, ops)
                    new_config[category] = stringify_config_object(new_config_obj)
            
            rec.config = new_config
            rec.save()
            
            results.append({
                'name': name,
                'success': True,
                'old_config': old_config,
                'new_config': new_config
            })
        
        return JsonResponse({'results': results})
    
    return JsonResponse({'error': 'Invalid request'}, status=400)
