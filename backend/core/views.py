from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import Group
from django.db import IntegrityError
from django.db.models import Max
from django.db.models.deletion import ProtectedError
from django.http import FileResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .exports import export_excel, export_pdf
from .models import CalendarBlockedDay, CalendarVersion, ExamCalendar, ExamEvent, Rule, Subject
from .serializers import (
    CalendarVersionSerializer,
    ExamCalendarSerializer,
    ExamEventSerializer,
    RuleSerializer,
    SubjectSerializer,
    UserSerializer,
)
from .services import build_snapshot, validate_exam_assignment


@method_decorator(ensure_csrf_cookie, name='dispatch')
class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user = authenticate(username=request.data.get('username'), password=request.data.get('password'))
        if not user:
            return Response({'detail': 'Credenciales inválidas'}, status=status.HTTP_400_BAD_REQUEST)
        login(request, user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({'detail': 'Sesión cerrada'})


@method_decorator(ensure_csrf_cookie, name='dispatch')
class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all().order_by('name')
    serializer_class = SubjectSerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except (ProtectedError, IntegrityError):
            return Response(
                {'detail': 'No se puede eliminar la materia porque está siendo utilizada por otros registros.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class RuleViewSet(viewsets.ModelViewSet):
    queryset = Rule.objects.all().order_by('-id')
    serializer_class = RuleSerializer


class CalendarVersionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CalendarVersion.objects.select_related('calendar').all()
    serializer_class = CalendarVersionSerializer


class ExamCalendarViewSet(viewsets.ModelViewSet):
    queryset = ExamCalendar.objects.all().order_by('-created_at')
    serializer_class = ExamCalendarSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def validate_assignment(self, request, pk=None):
        calendar = self.get_object()
        subject = Subject.objects.get(id=request.data['subject'])
        result = validate_exam_assignment(calendar, subject, request.data['date'], request.data.get('event_id'))
        return Response(result)

    @action(detail=True, methods=['post'])
    def assign_event(self, request, pk=None):
        calendar = self.get_object()
        subject = Subject.objects.get(id=request.data['subject'])
        target_date = request.data['date']
        event = None
        if request.data.get('event_id'):
            event = ExamEvent.objects.get(id=request.data['event_id'], calendar=calendar)
            result = validate_exam_assignment(calendar, subject, target_date, event.id)
        else:
            result = validate_exam_assignment(calendar, subject, target_date)

        if not result['is_valid']:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        if event:
            event.date = target_date
            event.save()
        else:
            event, _ = ExamEvent.objects.update_or_create(calendar=calendar, subject=subject, defaults={'date': target_date})
        data = ExamEventSerializer(event).data
        data['warning'] = result if result['severity'] == 'soft' else None
        return Response(data)

    @action(detail=True, methods=['post'])
    def toggle_blocked_day(self, request, pk=None):
        calendar = self.get_object()
        date = request.data['date']
        blocked, created = CalendarBlockedDay.objects.get_or_create(calendar=calendar, date=date)
        if not created:
            blocked.delete()
            return Response({'blocked': False})
        return Response({'blocked': True})

    @action(detail=True, methods=['delete'], url_path='events/(?P<event_id>[^/.]+)')
    def remove_event(self, request, pk=None, event_id=None):
        event = ExamEvent.objects.get(id=event_id, calendar_id=pk)
        event.delete()
        return Response(status=204)

    @action(detail=True, methods=['post'])
    def save_version(self, request, pk=None):
        calendar = self.get_object()
        current = calendar.versions.aggregate(Max('version_number')).get('version_number__max') or 0
        version = CalendarVersion.objects.create(
            calendar=calendar,
            version_number=current + 1,
            label=request.data.get('label', ''),
            snapshot=build_snapshot(calendar),
            created_by=request.user,
        )
        return Response(CalendarVersionSerializer(version).data)

    @action(detail=True, methods=['post'], url_path='restore_version/(?P<version_id>[^/.]+)')
    def restore_version(self, request, pk=None, version_id=None):
        calendar = self.get_object()
        version = CalendarVersion.objects.get(id=version_id, calendar=calendar)
        snapshot = version.snapshot
        calendar.events.all().delete()
        calendar.blocked_days.all().delete()
        for b in snapshot.get('blocked_days', []):
            CalendarBlockedDay.objects.create(calendar=calendar, date=b['date'], reason=b.get('reason', 'FERIADO/BLOQUEADO'))
        for e in snapshot.get('events', []):
            ExamEvent.objects.create(calendar=calendar, subject_id=e['subject_id'], date=e['date'])
        return Response({'detail': 'Versión restaurada'})

    @action(detail=True, methods=['delete'], url_path='versions/(?P<version_id>[^/.]+)')
    def delete_version(self, request, pk=None, version_id=None):
        calendar = self.get_object()
        version = CalendarVersion.objects.get(id=version_id, calendar=calendar)
        version.delete()
        return Response(status=204)

    @action(detail=True, methods=['get'], url_path='export/excel')
    def export_excel_action(self, request, pk=None):
        calendar = self.get_object()
        version_id = request.query_params.get('version_id')
        snapshot = CalendarVersion.objects.get(id=version_id, calendar=calendar).snapshot if version_id else None
        content = export_excel(calendar, snapshot)
        return FileResponse(content, as_attachment=True, filename=f'{calendar.name}.xlsx')

    @action(detail=True, methods=['get'], url_path='export/pdf')
    def export_pdf_action(self, request, pk=None):
        calendar = self.get_object()
        version_id = request.query_params.get('version_id')
        snapshot = CalendarVersion.objects.get(id=version_id, calendar=calendar).snapshot if version_id else None
        content = export_pdf(calendar, snapshot)
        return FileResponse(content, as_attachment=True, filename=f'{calendar.name}.pdf')


def ensure_roles():
    for role in ['admin', 'editor', 'viewer']:
        Group.objects.get_or_create(name=role)
