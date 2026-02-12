import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { Draggable } from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'
import toast from 'react-hot-toast'
import { api } from '../api'

const colorByGroup: Record<string, string> = {
  SEM2: '#1f77b4',
  SEM4: '#2ca02c',
  EXTRA: '#ff7f0e',
}
const weekdayOptions = [
  { value: 'Monday', label: 'Lunes' },
  { value: 'Tuesday', label: 'Martes' },
  { value: 'Wednesday', label: 'Miércoles' },
  { value: 'Thursday', label: 'Jueves' },
  { value: 'Friday', label: 'Viernes' },
  { value: 'Saturday', label: 'Sábado' },
]
const weekdayLabelsES: Record<string, string> = {
  Monday: 'Lunes',
  Tuesday: 'Martes',
  Wednesday: 'Miércoles',
  Thursday: 'Jueves',
  Friday: 'Viernes',
  Saturday: 'Sábado',
  Sunday: 'Domingo',
}
const weekdayLabel = (value: string) => weekdayLabelsES[value] || value
const toIsoDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const addOneDay = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return toIsoDate(d)
}

export function CalendarPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [calendar, setCalendar] = useState<any>()
  const [subjects, setSubjects] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({ SEM2: '', SEM4: '', EXTRA: '' })
  const [newRule, setNewRule] = useState({
    rule_type: 'PREFER_SAME_DAY',
    severity: 'SOFT',
    subject_a: '',
    subject_b: '',
    weekday: 'Friday',
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const draggableRef = useRef<Draggable | null>(null)
  const pendingAssignRef = useRef<Set<string>>(new Set())

  const load = async () => {
    const [c, s, r, v] = await Promise.all([api.get(`/calendars/${id}/`), api.get('/subjects/'), api.get('/rules/'), api.get('/versions/')])
    setCalendar(c.data)
    setSubjects(s.data)
    setRules(r.data.filter((x: any)=>x.calendar === Number(id) || x.global_rule))
    setVersions(v.data.filter((x: any)=>x.calendar === Number(id)))
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (!calendar || !containerRef.current || draggableRef.current) return
    draggableRef.current = new Draggable(containerRef.current, {
      itemSelector: '.draggable-subject',
      eventData: (el) => ({
        title: el.getAttribute('data-title') || '',
        extendedProps: {
          subjectId: Number(el.getAttribute('data-id')),
          semesterGroup: el.getAttribute('data-group'),
        },
      }),
    })

    return () => {
      draggableRef.current?.destroy()
      draggableRef.current = null
    }
  }, [calendar])

  const blockedDates = useMemo(() => new Set((calendar?.blocked_days || []).map((b: any) => b.date)), [calendar])
  const heavyBySubjectId = useMemo(() => {
    const map = new Map<number, boolean>()
    for (const s of subjects) map.set(s.id, !!s.is_heavy)
    return map
  }, [subjects])

  const isDateInRange = (dateStr: string) => dateStr >= calendar.start_date && dateStr <= calendar.end_date
  const isDateBlocked = (dateStr: string) => blockedDates.has(dateStr)
  const isSunday = (dateStr: string) => new Date(`${dateStr}T00:00:00`).getDay() === 0
  const rangeEndExclusive = calendar ? addOneDay(calendar.end_date) : ''

  const compactIrrelevantWeeks = () => {
    const root = calendarRef.current
    if (!root) return
    const rows = root.querySelectorAll('.fc-daygrid-body tbody tr')
    rows.forEach((row) => {
      const dayCells = Array.from(row.querySelectorAll('.fc-daygrid-day[data-date]'))
      const hasImportantDay = dayCells.some((cell) => {
        const dateStr = (cell as HTMLElement).getAttribute('data-date')
        return !!dateStr && isDateInRange(dateStr)
      })
      row.classList.toggle('week-row-compact', !hasImportantDay)
    })
  }

  const events = useMemo(() => (
    (calendar?.events || []).map((e: any) => ({
      id: String(e.id),
      title: e.subject_name,
      start: e.date,
      allDay: true,
      backgroundColor: colorByGroup[e.semester_group] || '#7f7f7f',
      borderColor: colorByGroup[e.semester_group] || '#7f7f7f',
      classNames: heavyBySubjectId.get(e.subject) ? ['event-heavy'] : [],
    }))
  ), [calendar, heavyBySubjectId])
  const assignedIds = new Set((calendar?.events || []).map((e: any)=>e.subject))
  const subjectNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const s of subjects) map.set(s.id, s.name)
    return map
  }, [subjects])

  if (!calendar) return <div>Cargando...</div>

  const assign = async (subject: number, date: string, eventId?: string) => {
    const requestKey = `${subject}-${date}-${eventId || 'new'}`
    if (pendingAssignRef.current.has(requestKey)) return true
    pendingAssignRef.current.add(requestKey)
    try {
      const res = await api.post(`/calendars/${id}/assign_event/`, { subject, date, event_id: eventId })
      if (res.data.warning) toast(res.data.warning.message, { icon: '⚠️' })
      else toast.success('Asignación guardada')
      await load()
      return true
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'No se pudo asignar')
      return false
    } finally {
      pendingAssignRef.current.delete(requestKey)
    }
  }

  const createRule = async () => {
    if (newRule.rule_type === 'SUBJECT_ONLY_WEEKDAYS' && !newRule.subject_a) {
      toast.error('Seleccioná una materia para la restricción de día único.')
      return
    }
    const params =
      newRule.rule_type === 'SUBJECT_ONLY_WEEKDAYS'
        ? { allowed_weekdays: [newRule.weekday] }
        : {}
    await api.post('/rules/', {
      rule_type: newRule.rule_type,
      severity: newRule.severity,
      calendar: Number(id),
      subject_a: newRule.subject_a || null,
      subject_b: newRule.rule_type === 'SUBJECT_ONLY_WEEKDAYS' ? null : (newRule.subject_b || null),
      params,
      enabled: true,
      global_rule: false,
    })
    toast.success('Regla creada')
    load()
  }

  const deleteRule = async (rule: any) => {
    const target = rule.global_rule ? 'global' : 'del calendario'
    if (!window.confirm(`¿Eliminar esta restricción ${target}?`)) return
    await api.delete(`/rules/${rule.id}/`)
    toast.success('Restricción eliminada')
    await load()
  }

  const severityLabel = (severity: string) => (severity === 'HARD' ? 'fuerte' : 'suave')

  const formatRule = (rule: any) => {
    const a = rule.subject_a ? subjectNameById.get(rule.subject_a) || `Materia ${rule.subject_a}` : 'Materia A'
    const b = rule.subject_b ? subjectNameById.get(rule.subject_b) || `Materia ${rule.subject_b}` : 'Materia B'
    const suffix = rule.global_rule ? ' [regla global]' : ''

    if (rule.rule_type === 'SAME_DAY') {
      return `${a} se debe rendir el mismo día que ${b} (${severityLabel(rule.severity)})${suffix}`
    }
    if (rule.rule_type === 'PREFER_SAME_DAY') {
      return `${a} idealmente se rinde el mismo día que ${b} (${severityLabel(rule.severity)})${suffix}`
    }
    if (rule.rule_type === 'HEAVY_NOT_SAME_DAY') {
      return `Las materias pesadas en la misma fecha o con 1 día de diferencia generan advertencia${suffix}`
    }
    if (rule.rule_type === 'SUBJECT_ONLY_WEEKDAYS') {
      const days = Array.isArray(rule.params?.allowed_weekdays) ? rule.params.allowed_weekdays : []
      const label = days.length ? days.map((d: string) => weekdayLabel(d)).join(', ') : 'día específico'
      return `${a} solo puede rendirse los ${label} (${severityLabel(rule.severity)})${suffix}`
    }
    return `${rule.rule_type} (${severityLabel(rule.severity)})${suffix}`
  }

  return <div className='page calendar-layout'>
    <div className='sidebar' ref={containerRef}>
      {['SEM2','SEM4','EXTRA'].map(group => <div className='card' key={group}><h3>{group === 'SEM2' ? 'Asignaturas 2do semestre' : group === 'SEM4' ? 'Asignaturas 4to semestre' : 'Asignaturas extra'}</h3><input placeholder='Buscar...' value={filters[group]} onChange={e=>setFilters({...filters,[group]:e.target.value})} />{subjects.filter(s=>s.semester_group===group && !assignedIds.has(s.id) && s.name.toLowerCase().includes(filters[group].toLowerCase())).map(s=><div key={s.id} className='draggable-subject' data-id={s.id} data-group={s.semester_group} data-title={s.name} style={{borderLeft:`6px solid ${colorByGroup[s.semester_group] || '#7f7f7f'}`}}><span className={s.is_heavy ? 'subject-heavy' : ''}>{s.name}{s.is_heavy ? ' (Pesada)' : ''}</span></div>)}</div>)}
    </div>
    <div className='main'>
      <div className='toolbar'>
        <button onClick={()=>navigate('/')}>Volver al inicio</button>
        <button onClick={async()=>{await api.post(`/calendars/${id}/save_version/`, {label:`Borrador ${versions.length+1}`}); toast.success('Versión guardada'); load()}}>Guardar versión</button>
        <button onClick={()=>window.open(`http://localhost:8000/api/calendars/${id}/export/pdf/`)}>Exportar PDF</button>
        <button onClick={()=>window.open(`http://localhost:8000/api/calendars/${id}/export/excel/`)}>Exportar Excel</button>
      </div>
      <div ref={calendarRef}>
      <FullCalendar plugins={[dayGridPlugin, interactionPlugin]} locales={[esLocale]} locale='es' firstDay={1} initialView='dayGridMonth' initialDate={calendar.start_date} headerToolbar={false} editable droppable fixedWeekCount={false} showNonCurrentDates={false} validRange={{ start: calendar.start_date, end: rangeEndExclusive }} visibleRange={{ start: calendar.start_date, end: rangeEndExclusive }} events={events}
        datesSet={() => { window.setTimeout(compactIrrelevantWeeks, 0) }}
        dayCellClassNames={(arg) => {
          const dateStr = toIsoDate(arg.date)
          if (isDateBlocked(dateStr) || isSunday(dateStr)) return ['blocked-day-cell']
          if (!isDateInRange(dateStr)) return ['out-of-range-day-cell']
          return []
        }}
        dayCellDidMount={(arg) => {
          const dateStr = toIsoDate(arg.date)
          if (!isDateBlocked(dateStr)) return
          const top = arg.el.querySelector('.fc-daygrid-day-top')
          if (!top || top.querySelector('.feriado-badge')) return
          const badge = document.createElement('span')
          badge.className = 'feriado-badge'
          badge.textContent = 'Feriado'
          top.appendChild(badge)
        }}
        eventAllow={(dropInfo) => {
          const dateStr = toIsoDate(dropInfo.start)
          return isDateInRange(dateStr) && !isDateBlocked(dateStr) && !isSunday(dateStr)
        }}
        eventDrop={async (info) => { const ok = await assign(calendar.events.find((e:any)=>String(e.id)===info.event.id).subject, info.event.startStr, info.event.id); if (!ok) info.revert() }}
        drop={async (info) => {
          const dateStr = info.dateStr
          if (!isDateInRange(dateStr)) {
            toast.error('La fecha está fuera del rango del calendario.')
            info.revert()
            return
          }
          if (isDateBlocked(dateStr)) {
            toast.error('No se puede asignar en un día feriado/bloqueado.')
            info.revert()
            return
          }
          if (isSunday(dateStr)) {
            toast.error('No se puede asignar en domingo.')
            info.revert()
            return
          }
          const subject = Number(info.draggedEl.getAttribute('data-id'))
          const ok = await assign(subject, dateStr)
          if (!ok) info.revert()
        }}
        eventClick={async(info)=>{ if(window.confirm('¿Quitar evento?')) { await api.delete(`/calendars/${id}/events/${info.event.id}/`); toast.success('Evento eliminado'); load() } }}
        dateClick={async (arg) => { if (!window.confirm(`¿Toggle feriado/bloqueado para ${arg.dateStr}?`)) return; await api.post(`/calendars/${id}/toggle_blocked_day/`, { date: arg.dateStr }); toast.success('Bloqueo actualizado'); load() }}
      />
      </div>
      <div className='card'><h3>Versiones</h3>{versions.map(v=><div key={v.id} className='row'><span>v{v.version_number} - {v.label || 'Sin etiqueta'}</span><button onClick={async()=>{await api.post(`/calendars/${id}/restore_version/${v.id}/`); toast.success('Restaurado'); load()}}>Restaurar</button><button onClick={()=>window.open(`http://localhost:8000/api/calendars/${id}/export/pdf/?version_id=${v.id}`)}>PDF</button></div>)}</div>
      <div className='card'><h3>Restricciones</h3><div className='row'><select value={newRule.rule_type} onChange={e=>setNewRule({...newRule, rule_type:e.target.value})}><option value='SAME_DAY'>Mismo día obligatorio</option><option value='PREFER_SAME_DAY'>Preferir mismo día</option><option value='HEAVY_NOT_SAME_DAY'>Advertencia para pesadas cercanas</option><option value='SUBJECT_ONLY_WEEKDAYS'>Solo día específico</option></select><select value={newRule.severity} onChange={e=>setNewRule({...newRule, severity:e.target.value})}><option value='HARD'>Fuerte</option><option value='SOFT'>Suave</option></select><select value={newRule.subject_a} onChange={e=>setNewRule({...newRule,subject_a:e.target.value})}><option value=''>Materia A</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>{newRule.rule_type === 'SUBJECT_ONLY_WEEKDAYS' ? <select value={newRule.weekday} onChange={e=>setNewRule({...newRule, weekday:e.target.value})}>{weekdayOptions.map(w=><option key={w.value} value={w.value}>{w.label}</option>)}</select> : <select value={newRule.subject_b} onChange={e=>setNewRule({...newRule,subject_b:e.target.value})}><option value=''>Materia B</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>}<button onClick={createRule}>Crear</button></div>{rules.map(r=><div key={r.id} className='row item'><span>{formatRule(r)}</span><button onClick={()=>deleteRule(r)}>Eliminar</button></div>)}</div>
    </div>
  </div>
}
