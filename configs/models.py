from django.db import models

# Create your models here.

class ConfigRecord(models.Model):
    name = models.CharField(max_length=100)
    config = models.JSONField()

    def __str__(self):
        return self.name
