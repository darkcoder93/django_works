from django.core.management.base import BaseCommand
from configs.models import ConfigRecord

class Command(BaseCommand):
    help = 'Insert dummy data into ConfigRecord collection'

    def handle(self, *args, **kwargs):
        data = [
            {
                'name': 'ServerA',
                'config': {
                    'category1': 'key1 value1;key2 value2',
                    'category2': 'key3 value3;key4 value4'
                }
            },
            {
                'name': 'ServerB',
                'config': {
                    'category1': 'key5 value5;key6 value6',
                    'category2': 'key7 value7;key8 value8'
                }
            },
            {
                'name': 'ServerC',
                'config': {
                    'category1': 'key9 value9;key10 value10',
                    'category2': 'key11 value11;key12 value12'
                }
            }
        ]
        for entry in data:
            ConfigRecord.objects.update_or_create(name=entry['name'], defaults={'config': entry['config']})
        self.stdout.write(self.style.SUCCESS('Dummy data inserted.')) 