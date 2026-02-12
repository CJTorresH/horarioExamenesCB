from django.contrib import admin

from .models import CalendarBlockedDay, CalendarVersion, ExamCalendar, ExamEvent, Rule, Subject

admin.site.register([Subject, ExamCalendar, CalendarBlockedDay, ExamEvent, Rule, CalendarVersion])
