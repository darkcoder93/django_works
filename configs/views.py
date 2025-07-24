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


@csrf_exempt
def api_update_configs(request):
    if request.method == 'POST':
        body = json.loads(request.body)
        name = body.get('name')
        new_config = body.get('new_config')
        old_config = {}
        try:
            rec = ConfigRecord.objects.get(name=name)
            old_config = rec.config.copy()
            rec.config = new_config
            rec.save()
        except ConfigRecord.DoesNotExist:
            rec = ConfigRecord.objects.create(name=name, config=new_config)
        return JsonResponse({'success': True, 'old_config': old_config, 'new_config': new_config})
    return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)
