import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../api'

export function HomePage() {
  const [calendars, setCalendars] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [name, setName] = useState('2026-1')
  const [periodType, setPeriodType] = useState('P1')
  const [startDate, setStartDate] = useState('2026-02-01')
  const [endDate, setEndDate] = useState('2026-02-28')
  const [newSubject, setNewSubject] = useState({ name: '', semester_group: 'SEM2', is_heavy: false })
  const navigate = useNavigate()

  const load = () => Promise.all([
    api.get('/calendars/').then(r => setCalendars(r.data)),
    api.get('/versions/').then(r => setVersions(r.data)),
    api.get('/subjects/').then(r => setSubjects(r.data)),
  ])
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!startDate || !endDate) return
    if (startDate > endDate) return
    const res = await api.post('/calendars/', { name, period_type: periodType, start_date: startDate, end_date: endDate })
    navigate(`/calendars/${res.data.id}`)
  }

  const createSubject = async () => {
    await api.post('/subjects/', { ...newSubject, allowed_weekdays: [], fixed_dates: [], code: '' })
    setNewSubject({ name: '', semester_group: 'SEM2', is_heavy: false })
    load()
  }

  const deleteCalendar = async (calendarId: number) => {
    if (!window.confirm('¿Eliminar este calendario? Esta acción no se puede deshacer.')) return
    await api.delete(`/calendars/${calendarId}/`)
    load()
  }

  const restoreVersion = async (calendarId: number, versionId: number) => {
    if (!window.confirm('¿Cargar esta versión guardada del calendario?')) return
    await api.post(`/calendars/${calendarId}/restore_version/${versionId}/`)
    toast.success('Versión cargada')
    await load()
  }

  const deleteVersion = async (calendarId: number, versionId: number) => {
    if (!window.confirm('¿Eliminar esta versión guardada?')) return
    await api.delete(`/calendars/${calendarId}/versions/${versionId}/`)
    toast.success('Versión eliminada')
    await load()
  }

  return <div className='page'>
    <div className='card'><h2>Calendarios</h2><div className='row'><input value={name} onChange={e=>setName(e.target.value)} /><select value={periodType} onChange={e=>setPeriodType(e.target.value)}><option value='P1'>Parcial 1</option><option value='P2'>Parcial 2</option><option value='F1'>Final 1</option><option value='F2'>Final 2</option></select><input type='date' value={startDate} onChange={e=>setStartDate(e.target.value)} /><input type='date' value={endDate} onChange={e=>setEndDate(e.target.value)} /><button onClick={create}>Nuevo calendario</button></div>{calendars.map(c=><div key={c.id} className='item'><div className='row'><span style={{cursor:'pointer'}} onClick={()=>navigate(`/calendars/${c.id}`)}>{c.name} - {c.period_type} ({c.start_date} a {c.end_date})</span><button onClick={()=>deleteCalendar(c.id)}>Eliminar</button></div>{versions.filter(v=>v.calendar===c.id).map(v=><div key={v.id} className='row'><span>Versión {v.version_number}{v.label ? ` - ${v.label}` : ''}</span><button onClick={()=>restoreVersion(c.id, v.id)}>Cargar versión</button><button onClick={()=>deleteVersion(c.id, v.id)}>Eliminar versión</button></div>)}</div>)}</div>
    <div className='card'><h2>Asignaturas (gestión básica)</h2><div className='row'><input placeholder='Nombre' value={newSubject.name} onChange={e=>setNewSubject({...newSubject,name:e.target.value})}/><select value={newSubject.semester_group} onChange={e=>setNewSubject({...newSubject,semester_group:e.target.value})}><option value='SEM2'>SEM2</option><option value='SEM4'>SEM4</option><option value='EXTRA'>EXTRA</option></select><label><input type='checkbox' checked={newSubject.is_heavy} onChange={e=>setNewSubject({...newSubject,is_heavy:e.target.checked})}/>Pesada</label><button onClick={createSubject}>Agregar</button></div>{subjects.map(s=><div className='row item' key={s.id}><span>{s.name} ({s.semester_group})</span><button onClick={async()=>{await api.patch(`/subjects/${s.id}/`,{is_heavy:!s.is_heavy});load()}}>Cambiar pesada</button><button onClick={async()=>{await api.delete(`/subjects/${s.id}/`);load()}}>Eliminar</button></div>)}</div>
  </div>
}
