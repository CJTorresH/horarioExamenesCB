from django.contrib.auth.models import Group, User
from django.core.management.base import BaseCommand

from core.models import CalendarBlockedDay, ExamCalendar, Rule, Subject


class Command(BaseCommand):
    help = 'Carga datos demo'

    def handle(self, *args, **options):
        for role in ['admin', 'editor', 'viewer']:
            Group.objects.get_or_create(name=role)

        admin, created = User.objects.get_or_create(username='admin')
        if created:
            admin.set_password('admin123')
            admin.is_staff = True
            admin.is_superuser = True
            admin.save()

        subjects = [
            ('Electricidad y Magnetismo', 'SEM4', True, []),
            ('Mecánica y Calor', 'SEM4', True, []),
            ('Cálculo I', 'SEM2', True, []),
            ('Álgebra Lineal', 'SEM2', True, []),
            ('Asignatura Extra X', 'EXTRA', False, []),
            ('Solo Sábados', 'EXTRA', False, ['Saturday']),
        ]
        map_subject = {}
        for name, group, heavy, weekdays in subjects:
            obj, _ = Subject.objects.get_or_create(name=name, defaults={'semester_group': group, 'is_heavy': heavy, 'allowed_weekdays': weekdays})
            map_subject[name] = obj

        cal, _ = ExamCalendar.objects.get_or_create(
            name='2026-1',
            period_type='P1',
            defaults={'start_date': '2026-02-01', 'end_date': '2026-02-28', 'created_by': admin},
        )
        CalendarBlockedDay.objects.get_or_create(calendar=cal, date='2026-02-10')

        Rule.objects.get_or_create(
            calendar=cal,
            rule_type='SAME_DAY',
            subject_a=map_subject['Electricidad y Magnetismo'],
            subject_b=map_subject['Mecánica y Calor'],
            defaults={'severity': 'HARD'},
        )
        Rule.objects.get_or_create(
            calendar=cal,
            rule_type='HEAVY_NOT_SAME_DAY',
            defaults={'severity': 'SOFT'},
        )

        self.stdout.write(self.style.SUCCESS('Seed demo cargado. Usuario admin/admin123'))
