import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { Draggable } from '@fullcalendar/interaction'
import toast from 'react-hot-toast'
import { api } from '../api'

const colors: Record<string, string> = { SEM2: '#5b6670', SEM4: '#7b8794', OPEN: '#4f6d7a' }

export function CalendarPage() {
  const { id } = useParams()
  const [calendar, setCalendar] = useState<any>()
  const [subjects, setSubjects] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({ SEM2: '', SEM4: '', OPEN: '' })
  const [newRule, setNewRule] = useState({ rule_type: 'PREFER_SAME_DAY', severity: 'SOFT', subject_a: '', subject_b: '' })
  const containerRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    const [c, s, r, v] = await Promise.all([api.get(`/calendars/${id}/`), api.get('/subjects/'), api.get('/rules/'), api.get('/versions/')])
    setCalendar(c.data)
    setSubjects(s.data)
    setRules(r.data.filter((x: any)=>x.calendar === Number(id) || x.global_rule))
    setVersions(v.data.filter((x: any)=>x.calendar === Number(id)))
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (containerRef.current) {
      new Draggable(containerRef.current, { itemSelector: '.draggable-subject', eventData: (el) => ({ title: el.getAttribute('data-title') || '', extendedProps: { subjectId: Number(el.getAttribute('data-id')), semesterGroup: el.getAttribute('data-group') } }) })
    }
  }, [subjects])

  const events = useMemo(() => (calendar?.events || []).map((e: any) => ({ id: String(e.id), title: e.subject_name, start: e.date, allDay: true, backgroundColor: colors[e.semester_group] })), [calendar])
  const assignedIds = new Set((calendar?.events || []).map((e: any)=>e.subject))

  if (!calendar) return <div>Cargando...</div>

  const assign = async (subject: number, date: string, eventId?: string) => {
    try {
      const res = await api.post(`/calendars/${id}/assign_event/`, { subject, date, event_id: eventId })
      if (res.data.warning) toast(res.data.warning.message, { icon: '⚠️' })
      else toast.success('Asignación guardada')
      load()
      return true
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'No se pudo asignar')
      return false
    }
  }

  const createRule = async () => {
    await api.post('/rules/', { ...newRule, calendar: Number(id), subject_a: newRule.subject_a || null, subject_b: newRule.subject_b || null, enabled: true, global_rule: false })
    toast.success('Regla creada')
    load()
  }

  return <div className='page calendar-layout'>
    <div className='sidebar' ref={containerRef}>
      {['SEM2','SEM4','OPEN'].map(group => <div className='card' key={group}><h3>{group === 'SEM2' ? 'Asignaturas 2do semestre' : group === 'SEM4' ? 'Asignaturas 4to semestre' : 'Asignaturas abiertas'}</h3><input placeholder='Buscar...' value={filters[group]} onChange={e=>setFilters({...filters,[group]:e.target.value})} />{subjects.filter(s=>s.semester_group===group && !assignedIds.has(s.id) && s.name.toLowerCase().includes(filters[group].toLowerCase())).map(s=><div key={s.id} className='draggable-subject' data-id={s.id} data-group={s.semester_group} data-title={s.name} style={{borderLeft:`6px solid ${colors[group]}`}}>{s.name}</div>)}</div>)}
    </div>
    <div className='main'>
      <div className='toolbar'>
        <button onClick={async()=>{await api.post(`/calendars/${id}/save_version/`, {label:`Borrador ${versions.length+1}`}); toast.success('Versión guardada'); load()}}>Guardar versión</button>
        <button onClick={()=>window.open(`http://localhost:8000/api/calendars/${id}/export/pdf/`)}>Exportar PDF</button>
        <button onClick={()=>window.open(`http://localhost:8000/api/calendars/${id}/export/excel/`)}>Exportar Excel</button>
      </div>
      <FullCalendar plugins={[dayGridPlugin, interactionPlugin]} initialView='dayGridMonth' editable droppable validRange={{ start: calendar.start_date, end: calendar.end_date }} events={events}
        eventDrop={async (info) => { const ok = await assign(calendar.events.find((e:any)=>String(e.id)===info.event.id).subject, info.event.startStr, info.event.id); if (!ok) info.revert() }}
        drop={async (info) => { const subject = Number(info.draggedEl.getAttribute('data-id')); const ok = await assign(subject, info.dateStr); if (!ok) info.revert() }}
        eventClick={async(info)=>{ if(window.confirm('¿Quitar evento?')) { await api.delete(`/calendars/${id}/events/${info.event.id}/`); toast.success('Evento eliminado'); load() } }}
        dateClick={async (arg) => { if (!window.confirm(`¿Toggle feriado/bloqueado para ${arg.dateStr}?`)) return; await api.post(`/calendars/${id}/toggle_blocked_day/`, { date: arg.dateStr }); toast.success('Bloqueo actualizado'); load() }}
      />
      <div className='card'><h3>Versiones</h3>{versions.map(v=><div key={v.id} className='row'><span>v{v.version_number} - {v.label || 'Sin etiqueta'}</span><button onClick={async()=>{await api.post(`/calendars/${id}/restore_version/${v.id}/`); toast.success('Restaurado'); load()}}>Restaurar</button><button onClick={()=>window.open(`http://localhost:8000/api/calendars/${id}/export/pdf/?version_id=${v.id}`)}>PDF</button></div>)}</div>
      <div className='card'><h3>Reglas</h3><div className='row'><select value={newRule.rule_type} onChange={e=>setNewRule({...newRule, rule_type:e.target.value})}><option value='SAME_DAY'>SAME_DAY</option><option value='PREFER_SAME_DAY'>PREFER_SAME_DAY</option><option value='HEAVY_NOT_SAME_DAY'>HEAVY_NOT_SAME_DAY</option></select><select value={newRule.severity} onChange={e=>setNewRule({...newRule, severity:e.target.value})}><option value='HARD'>HARD</option><option value='SOFT'>SOFT</option></select><select value={newRule.subject_a} onChange={e=>setNewRule({...newRule,subject_a:e.target.value})}><option value=''>A</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={newRule.subject_b} onChange={e=>setNewRule({...newRule,subject_b:e.target.value})}><option value=''>B</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><button onClick={createRule}>Crear</button></div>{rules.map(r=><div key={r.id}>{r.rule_type} ({r.severity})</div>)}</div>
    </div>
  </div>
}
