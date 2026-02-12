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
        extra_kwargs = {
            'start_date': {'required': False},
            'end_date': {'required': False},
        }

    def validate(self, attrs):
        import datetime

        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')

        if start_date and not end_date:
            attrs['end_date'] = start_date + datetime.timedelta(days=27)
        elif end_date and not start_date:
            attrs['start_date'] = end_date - datetime.timedelta(days=27)
        elif not start_date and not end_date:
            today = datetime.date.today()
            attrs['start_date'] = today
            attrs['end_date'] = today + datetime.timedelta(days=27)

        if attrs['start_date'] > attrs['end_date']:
            raise serializers.ValidationError('La fecha de inicio no puede ser mayor a la fecha de fin.')

        return attrs
