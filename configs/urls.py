from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('api/configs/', views.api_get_configs, name='api_get_configs'),
    path('api/update/', views.api_update_configs, name='api_update_configs'),
] 