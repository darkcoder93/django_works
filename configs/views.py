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
    """Convert config object to string format with semicolon delimiter at the end"""
    if not obj:
        return ""  # Empty config returns empty string (no semicolon)
    
    # Join all key-value pairs with semicolon and add semicolon at the end
    config_str = ';'.join([f"{k} {v}" for k, v in obj.items()])
    return config_str + ';'  # Add semicolon at the end for non-empty configs


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


# Helper: Generate color-coded diff for formatted config strings
def color_diff(old_formatted_str, new_formatted_str):
    """Generate color-coded diff for config strings in format 'config1:"key1 value1;key2 value2;"'"""
    
    # Parse the formatted strings back to dictionaries
    old_config = parse_formatted_config(old_formatted_str)
    new_config = parse_formatted_config(new_formatted_str)
    
    html_parts = []
    
    # Process all categories in new config
    for category in new_config:
        if category not in old_config:
            # New category added
            config_str = new_config[category]
            html_parts.append(f'<span class="added">{category}:"{config_str}"</span>')
        else:
            # Category exists in both, compare the config strings
            old_config_str = old_config[category]
            new_config_str = new_config[category]
            
            if old_config_str != new_config_str:
                # Config changed, generate diff for this category
                old_obj = parse_config_string(old_config_str)
                new_obj = parse_config_string(new_config_str)
                
                category_html_parts = []
                
                # Process keys in new config
                for k, v in new_obj.items():
                    if k not in old_obj:
                        # New key added - GREEN
                        category_html_parts.append(f'<span class="added">{k} {v}</span>')
                    elif old_obj[k] != v:
                        # Check if this is an append operation (new value contains old value + more)
                        if v.startswith(old_obj[k]) and len(v) > len(old_obj[k]):
                            # Value was appended - PINK
                            category_html_parts.append(f'<span class="appended">{k} {v}</span>')
                        else:
                            # Value was edited/changed - ORANGE
                            category_html_parts.append(f'<span class="edited">{k} {v}</span>')
                    else:
                        # No change
                        category_html_parts.append(f'{k} {v}')
                
                # Process keys that were deleted (in old but not in new)
                for k, v in old_obj.items():
                    if k not in new_obj:
                        # Key was deleted - ORANGE
                        category_html_parts.append(f'<span class="edited">{k} {v}</span>')
                
                category_diff = ';'.join(category_html_parts)
                html_parts.append(f'{category}:"{category_diff}"')
            else:
                # No change in this category
                html_parts.append(f'{category}:"{new_config_str}"')
    
    # Add categories that were deleted
    for category in old_config:
        if category not in new_config:
            config_str = old_config[category]
            html_parts.append(f'<span class="edited">{category}:"{config_str}"</span>')
    
    return '<br>'.join(html_parts)

def parse_formatted_config(formatted_str):
    """Parse formatted config string back to dictionary"""
    if not formatted_str:
        return {}
    
    config_dict = {}
    
    # Split by semicolon, line breaks, or <br> tags but be careful not to split inside quotes
    # First replace <br> tags with newlines for easier parsing
    formatted_str = formatted_str.replace('<br>', '\n')
    
    parts = []
    current_part = ""
    in_quotes = False
    
    for char in formatted_str:
        if char == '"':
            in_quotes = not in_quotes
            current_part += char
        elif (char == ';' or char == '\n') and not in_quotes:
            if current_part.strip():
                parts.append(current_part.strip())
            current_part = ""
        else:
            current_part += char
    
    # Add the last part
    if current_part.strip():
        parts.append(current_part.strip())
    
    for part in parts:
        if not part:
            continue
            
        # Look for pattern: category:"config_string"
        if ':"' in part and part.endswith('"'):
            colon_quote_pos = part.find(':"')
            category = part[:colon_quote_pos]
            config_str = part[colon_quote_pos + 2:-1]  # Remove ':"' and '"'
            config_dict[category] = config_str
    
    return config_dict


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
                old_config = rec.config
            except ConfigRecord.DoesNotExist:
                old_config = {}

            # Create a copy of old config for modification
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
                
                new_config_obj = apply_operations_to_config(old_config_obj, ops)
                new_config[category] = stringify_config_object(new_config_obj)

            # Convert configs to string format for display
            old_config_str = format_config_for_display(old_config)
            new_config_str = format_config_for_display(new_config)

            preview_rows.append({
                'name': name,
                'old_config': old_config_str,
                'new_config': color_diff(old_config_str, new_config_str)
            })

        return JsonResponse({'preview_rows': preview_rows})
    return JsonResponse({'error': 'Invalid request'}, status=400)

def format_config_for_display(config_dict):
    """Convert config dictionary to string format like 'config1:"key1 value1;key2 value2;"'"""
    if not config_dict:
        return ""
    
    formatted_parts = []
    for category, config_str in config_dict.items():
        if config_str:  # Only include non-empty configs
            formatted_parts.append(f'{category}:"{config_str}"')
    
    return '<br>'.join(formatted_parts)


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
