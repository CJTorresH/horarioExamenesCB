from django.db import migrations, models


def forwards_open_to_extra(apps, schema_editor):
    Subject = apps.get_model('core', 'Subject')
    Subject.objects.filter(semester_group='OPEN').update(semester_group='EXTRA')


def backwards_extra_to_open(apps, schema_editor):
    Subject = apps.get_model('core', 'Subject')
    Subject.objects.filter(semester_group='EXTRA').update(semester_group='OPEN')


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='subject',
            name='semester_group',
            field=models.CharField(
                max_length=8,
                choices=[('SEM2', '2do semestre'), ('SEM4', '4to semestre'), ('EXTRA', 'Extra')],
            ),
        ),
        migrations.RunPython(forwards_open_to_extra, backwards_extra_to_open),
    ]

