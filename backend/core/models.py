from django.conf import settings
from django.db import models


class Subject(models.Model):
    class SemesterGroup(models.TextChoices):
        SEM2 = 'SEM2', '2do semestre'
        SEM4 = 'SEM4', '4to semestre'
        OPEN = 'OPEN', 'Abiertas'

    name = models.CharField(max_length=200)
    code = models.CharField(max_length=40, blank=True)
    semester_group = models.CharField(max_length=8, choices=SemesterGroup.choices)
    is_heavy = models.BooleanField(default=False)
    allowed_weekdays = models.JSONField(default=list, blank=True)
    fixed_dates = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.name


class ExamCalendar(models.Model):
    class PeriodType(models.TextChoices):
        P1 = 'P1', 'Parcial 1'
        P2 = 'P2', 'Parcial 2'
        F1 = 'F1', 'Final 1'
        F2 = 'F2', 'Final 2'

    name = models.CharField(max_length=120)
    period_type = models.CharField(max_length=2, choices=PeriodType.choices)
    start_date = models.DateField()
    end_date = models.DateField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.name} ({self.get_period_type_display()})'


class CalendarBlockedDay(models.Model):
    calendar = models.ForeignKey(ExamCalendar, on_delete=models.CASCADE, related_name='blocked_days')
    date = models.DateField()
    reason = models.CharField(max_length=120, default='FERIADO/BLOQUEADO')

    class Meta:
        unique_together = ('calendar', 'date')


class ExamEvent(models.Model):
    calendar = models.ForeignKey(ExamCalendar, on_delete=models.CASCADE, related_name='events')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='events')
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('calendar', 'subject')


class Rule(models.Model):
    class RuleType(models.TextChoices):
        SAME_DAY = 'SAME_DAY', 'Mismo día'
        PREFER_SAME_DAY = 'PREFER_SAME_DAY', 'Preferir mismo día'
        FORBID_SAME_DAY = 'FORBID_SAME_DAY', 'Prohibir mismo día'
        HEAVY_NOT_SAME_DAY = 'HEAVY_NOT_SAME_DAY', 'Pesadas no mismo día'
        SUBJECT_ONLY_WEEKDAYS = 'SUBJECT_ONLY_WEEKDAYS', 'Solo días permitidos'
        SUBJECT_ONLY_FIXED_DATES = 'SUBJECT_ONLY_FIXED_DATES', 'Solo fechas fijas'

    class Severity(models.TextChoices):
        HARD = 'HARD', 'Hard'
        SOFT = 'SOFT', 'Soft'

    calendar = models.ForeignKey(ExamCalendar, on_delete=models.CASCADE, related_name='rules', null=True, blank=True)
    global_rule = models.BooleanField(default=False)
    rule_type = models.CharField(max_length=40, choices=RuleType.choices)
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.SOFT)
    subject_a = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='rules_a', null=True, blank=True)
    subject_b = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='rules_b', null=True, blank=True)
    params = models.JSONField(default=dict, blank=True)
    enabled = models.BooleanField(default=True)


class CalendarVersion(models.Model):
    calendar = models.ForeignKey(ExamCalendar, on_delete=models.CASCADE, related_name='versions')
    version_number = models.PositiveIntegerField()
    label = models.CharField(max_length=120, blank=True)
    snapshot = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)

    class Meta:
        unique_together = ('calendar', 'version_number')
        ordering = ['-version_number']
