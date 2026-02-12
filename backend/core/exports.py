from collections import defaultdict
from io import BytesIO

from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import ExamCalendar


def build_calendar_rows(calendar: ExamCalendar, snapshot=None):
    if snapshot:
        events = snapshot.get('events', [])
        blocked = {b['date']: b.get('reason', 'FERIADO/BLOQUEADO') for b in snapshot.get('blocked_days', [])}
        subject_ids = [e['subject_id'] for e in events]
        subjects = {s.id: s for s in calendar.events.model.subject.field.related_model.objects.filter(id__in=subject_ids)}
        rows = []
        for e in events:
            s = subjects[e['subject_id']]
            day_name = __import__('datetime').date.fromisoformat(e['date']).strftime('%A')
            rows.append((e['date'], day_name, s.name, s.semester_group, 'Sí' if s.is_heavy else 'No'))
        return rows, blocked
    rows = []
    for event in calendar.events.select_related('subject').order_by('date', 'subject__name'):
        rows.append((event.date.isoformat(), event.date.strftime('%A'), event.subject.name, event.subject.semester_group, 'Sí' if event.subject.is_heavy else 'No'))
    blocked = {b.date.isoformat(): b.reason for b in calendar.blocked_days.all()}
    return rows, blocked


def export_excel(calendar: ExamCalendar, snapshot=None):
    wb = Workbook()
    ws = wb.active
    ws.title = 'Exámenes'
    ws.append(['Periodo', 'Calendario', 'Fecha', 'Día de semana', 'Asignatura', 'Grupo', 'Pesada'])
    rows, _ = build_calendar_rows(calendar, snapshot)
    for r in rows:
        ws.append([calendar.get_period_type_display(), calendar.name, *r])

    summary = wb.create_sheet('Resumen')
    summary.append(['Fecha', 'Cantidad'])
    counter = defaultdict(int)
    for r in rows:
        counter[r[0]] += 1
    for day, qty in sorted(counter.items()):
        summary.append([day, qty])

    out = BytesIO()
    wb.save(out)
    out.seek(0)
    return out


def export_pdf(calendar: ExamCalendar, snapshot=None):
    out = BytesIO()
    doc = SimpleDocTemplate(out, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = [
        Paragraph('FIUNA - Planificador de Exámenes', styles['Title']),
        Paragraph(f'{calendar.name} - {calendar.get_period_type_display()}', styles['Heading2']),
        Paragraph(f'Rango: {calendar.start_date} a {calendar.end_date}', styles['Normal']),
        Spacer(1, 12),
    ]
    rows, blocked = build_calendar_rows(calendar, snapshot)
    data = [['Fecha', 'Día', 'Asignaturas']] 
    grouped = defaultdict(list)
    for date, day, subject, _, _ in rows:
        grouped[(date, day)].append(subject)
    for (date, day), subjects in sorted(grouped.items()):
        marker = f' ({blocked[date]})' if date in blocked else ''
        data.append([date, day, ', '.join(subjects) + marker])

    table = Table(data, colWidths=[90, 90, 320])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8a1e11')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(table)
    doc.build(elements)
    out.seek(0)
    return out
