from datetime import date, timedelta
import datetime
from typing import Optional

from .models import ExamCalendar, ExamEvent, Rule, Subject

WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
WEEKDAY_LABELS_ES = {
    'Monday': 'Lunes',
    'Tuesday': 'Martes',
    'Wednesday': 'Miércoles',
    'Thursday': 'Jueves',
    'Friday': 'Viernes',
    'Saturday': 'Sábado',
    'Sunday': 'Domingo',
}


def validate_exam_assignment(calendar: ExamCalendar, subject: Subject, target_date: date | str, event_id: Optional[int] = None):
    if isinstance(target_date, str):
        target_date = datetime.date.fromisoformat(target_date)
    rules = list(
        Rule.objects.filter(enabled=True).filter(global_rule=True) |
        Rule.objects.filter(enabled=True, calendar=calendar)
    )
    conflicts = []

    if target_date < calendar.start_date or target_date > calendar.end_date:
        conflicts.append(('HARD', 'La fecha está fuera del rango del calendario.'))

    if target_date.weekday() == 6:
        conflicts.append(('HARD', 'No se permiten exámenes los domingos.'))

    if calendar.blocked_days.filter(date=target_date).exists():
        conflicts.append(('HARD', 'El día está marcado como feriado/bloqueado.'))

    weekday_name = WEEKDAY_NAMES[target_date.weekday()]
    if subject.allowed_weekdays and weekday_name not in subject.allowed_weekdays:
        allowed_es = [WEEKDAY_LABELS_ES.get(day, day) for day in subject.allowed_weekdays]
        conflicts.append(('HARD', f'{subject.name} solo puede rendirse en: {", ".join(allowed_es)}.'))

    if subject.fixed_dates and target_date.isoformat() not in subject.fixed_dates:
        conflicts.append(('HARD', f'{subject.name} solo permite fechas específicas.'))

    # Excluimos el propio evento (si se mueve) y la misma materia para permitir
    # reasignaciones idempotentes sin falsos positivos.
    same_day_events = (
        ExamEvent.objects.filter(calendar=calendar, date=target_date)
        .exclude(id=event_id)
        .exclude(subject_id=subject.id)
    )

    for rule in rules:
        if rule.rule_type == Rule.RuleType.SAME_DAY and rule.subject_a_id and rule.subject_b_id:
            if subject.id in (rule.subject_a_id, rule.subject_b_id):
                other = rule.subject_b if subject.id == rule.subject_a_id else rule.subject_a
                if not ExamEvent.objects.filter(calendar=calendar, subject=other, date=target_date).exclude(id=event_id).exists():
                    conflicts.append((rule.severity, f'Restricción: {subject.name} debe rendirse junto a {other.name} el mismo día.'))

        if rule.rule_type == Rule.RuleType.PREFER_SAME_DAY and rule.subject_a_id and rule.subject_b_id:
            if subject.id in (rule.subject_a_id, rule.subject_b_id):
                other = rule.subject_b if subject.id == rule.subject_a_id else rule.subject_a
                if not ExamEvent.objects.filter(calendar=calendar, subject=other, date=target_date).exclude(id=event_id).exists():
                    conflicts.append(('SOFT', f'Preferencia: {subject.name} idealmente coincide con {other.name}.'))

        if rule.rule_type == Rule.RuleType.HEAVY_NOT_SAME_DAY:
            if subject.is_heavy:
                heavy_same_date = same_day_events.filter(subject__is_heavy=True).exists()
                heavy_adjacent_date = (
                    ExamEvent.objects.filter(calendar=calendar, subject__is_heavy=True)
                    .exclude(id=event_id)
                    .exclude(subject_id=subject.id)
                    .filter(date__in=[target_date - timedelta(days=1), target_date + timedelta(days=1)])
                    .exists()
                )

                # Regla ajustada: advertencia, no bloqueo.
                if heavy_same_date:
                    conflicts.append(('SOFT', 'Advertencia: hay más de una materia pesada en la misma fecha.'))
                if heavy_adjacent_date:
                    conflicts.append(('SOFT', 'Advertencia: hay materias pesadas con solo 1 día de separación.'))

        if rule.rule_type == Rule.RuleType.SUBJECT_ONLY_WEEKDAYS:
            if rule.subject_a_id == subject.id:
                allowed_weekdays = rule.params.get('allowed_weekdays') if isinstance(rule.params, dict) else None
                if isinstance(allowed_weekdays, str):
                    allowed_weekdays = [allowed_weekdays]
                if allowed_weekdays and weekday_name not in allowed_weekdays:
                    allowed_es = [WEEKDAY_LABELS_ES.get(day, day) for day in allowed_weekdays]
                    conflicts.append((rule.severity, f'{subject.name} solo puede rendirse en: {", ".join(allowed_es)}.'))

    # Evita mensajes repetidos cuando múltiples reglas producen la misma advertencia.
    hard = list(dict.fromkeys(msg for sev, msg in conflicts if sev == 'HARD'))
    soft = list(dict.fromkeys(msg for sev, msg in conflicts if sev == 'SOFT'))
    if hard:
        return {'is_valid': False, 'severity': 'hard', 'message': ' | '.join(hard)}
    if soft:
        return {'is_valid': True, 'severity': 'soft', 'message': ' | '.join(soft)}
    return {'is_valid': True, 'severity': None, 'message': 'OK'}


def build_snapshot(calendar: ExamCalendar):
    return {
        'events': [
            {'subject_id': e.subject_id, 'date': e.date.isoformat()} for e in calendar.events.select_related('subject')
        ],
        'blocked_days': [
            {'date': b.date.isoformat(), 'reason': b.reason} for b in calendar.blocked_days.all()
        ],
        'rules': [
            {
                'id': r.id,
                'rule_type': r.rule_type,
                'severity': r.severity,
                'subject_a_id': r.subject_a_id,
                'subject_b_id': r.subject_b_id,
                'params': r.params,
                'global_rule': r.global_rule,
                'enabled': r.enabled,
            }
            for r in Rule.objects.filter(calendar=calendar, enabled=True)
        ],
    }
