from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core import views

router = DefaultRouter()
router.register('subjects', views.SubjectViewSet, basename='subjects')
router.register('calendars', views.ExamCalendarViewSet, basename='calendars')
router.register('rules', views.RuleViewSet, basename='rules')
router.register('versions', views.CalendarVersionViewSet, basename='versions')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', views.LoginView.as_view()),
    path('api/auth/logout/', views.LogoutView.as_view()),
    path('api/auth/me/', views.MeView.as_view()),
    path('api/', include(router.urls)),
]
