from django.contrib.auth.models import User
from rest_framework import serializers

from .models import CalendarBlockedDay, CalendarVersion, ExamCalendar, ExamEvent, Rule, Subject


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'is_staff']


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = '__all__'


class CalendarBlockedDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarBlockedDay
        fields = '__all__'


class ExamEventSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    semester_group = serializers.CharField(source='subject.semester_group', read_only=True)

    class Meta:
        model = ExamEvent
        fields = ['id', 'calendar', 'subject', 'subject_name', 'semester_group', 'date', 'created_at', 'updated_at']


class RuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rule
        fields = '__all__'


class CalendarVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarVersion
        fields = '__all__'
        read_only_fields = ['version_number', 'snapshot', 'created_at', 'created_by']


class ExamCalendarSerializer(serializers.ModelSerializer):
    blocked_days = CalendarBlockedDaySerializer(many=True, read_only=True)
    events = ExamEventSerializer(many=True, read_only=True)

    class Meta:
        model = ExamCalendar
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']
