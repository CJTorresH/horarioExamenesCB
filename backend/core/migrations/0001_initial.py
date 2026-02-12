from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ExamCalendar',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('period_type', models.CharField(choices=[('P1', 'Parcial 1'), ('P2', 'Parcial 2'), ('F1', 'Final 1'), ('F2', 'Final 2')], max_length=2)),
                ('start_date', models.DateField()),
                ('end_date', models.DateField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='Subject',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('code', models.CharField(blank=True, max_length=40)),
                ('semester_group', models.CharField(choices=[('SEM2', '2do semestre'), ('SEM4', '4to semestre'), ('OPEN', 'Abiertas')], max_length=8)),
                ('is_heavy', models.BooleanField(default=False)),
                ('allowed_weekdays', models.JSONField(blank=True, default=list)),
                ('fixed_dates', models.JSONField(blank=True, default=list)),
            ],
        ),
        migrations.CreateModel(
            name='Rule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('global_rule', models.BooleanField(default=False)),
                ('rule_type', models.CharField(choices=[('SAME_DAY', 'Mismo día'), ('PREFER_SAME_DAY', 'Preferir mismo día'), ('FORBID_SAME_DAY', 'Prohibir mismo día'), ('HEAVY_NOT_SAME_DAY', 'Pesadas no mismo día'), ('SUBJECT_ONLY_WEEKDAYS', 'Solo días permitidos'), ('SUBJECT_ONLY_FIXED_DATES', 'Solo fechas fijas')], max_length=40)),
                ('severity', models.CharField(choices=[('HARD', 'Hard'), ('SOFT', 'Soft')], default='SOFT', max_length=10)),
                ('params', models.JSONField(blank=True, default=dict)),
                ('enabled', models.BooleanField(default=True)),
                ('calendar', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='rules', to='core.examcalendar')),
                ('subject_a', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='rules_a', to='core.subject')),
                ('subject_b', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='rules_b', to='core.subject')),
            ],
        ),
        migrations.CreateModel(
            name='ExamEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('calendar', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to='core.examcalendar')),
                ('subject', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to='core.subject')),
            ],
            options={'unique_together': {('calendar', 'subject')}},
        ),
        migrations.CreateModel(
            name='CalendarVersion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('version_number', models.PositiveIntegerField()),
                ('label', models.CharField(blank=True, max_length=120)),
                ('snapshot', models.JSONField(default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('calendar', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='versions', to='core.examcalendar')),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-version_number'], 'unique_together': {('calendar', 'version_number')}},
        ),
        migrations.CreateModel(
            name='CalendarBlockedDay',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('reason', models.CharField(default='FERIADO/BLOQUEADO', max_length=120)),
                ('calendar', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='blocked_days', to='core.examcalendar')),
            ],
            options={'unique_together': {('calendar', 'date')}},
        ),
    ]
