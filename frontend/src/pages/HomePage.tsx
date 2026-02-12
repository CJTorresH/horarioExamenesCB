import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export function HomePage() {
  const [calendars, setCalendars] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [name, setName] = useState('2026-1')
  const [periodType, setPeriodType] = useState('P1')
  const [newSubject, setNewSubject] = useState({ name: '', semester_group: 'SEM2', is_heavy: false })
  const navigate = useNavigate()

  const load = () => Promise.all([api.get('/calendars/').then(r => setCalendars(r.data)), api.get('/subjects/').then(r => setSubjects(r.data))])
  useEffect(() => { load() }, [])

  const create = async () => {
    const res = await api.post('/calendars/', { name, period_type: periodType, start_date: '2026-02-01', end_date: '2026-02-28' })
    navigate(`/calendars/${res.data.id}`)
  }

  const createSubject = async () => {
    await api.post('/subjects/', { ...newSubject, allowed_weekdays: [], fixed_dates: [], code: '' })
    setNewSubject({ name: '', semester_group: 'SEM2', is_heavy: false })
    load()
  }

  return <div className='page'>
    <div className='card'><h2>Calendarios</h2><div className='row'><input value={name} onChange={e=>setName(e.target.value)} /><select value={periodType} onChange={e=>setPeriodType(e.target.value)}><option value='P1'>Parcial 1</option><option value='P2'>Parcial 2</option><option value='F1'>Final 1</option><option value='F2'>Final 2</option></select><button onClick={create}>Nuevo calendario</button></div>{calendars.map(c=><div key={c.id} className='item' onClick={()=>navigate(`/calendars/${c.id}`)}>{c.name} - {c.period_type}</div>)}</div>
    <div className='card'><h2>Asignaturas (CRUD básico)</h2><div className='row'><input placeholder='Nombre' value={newSubject.name} onChange={e=>setNewSubject({...newSubject,name:e.target.value})}/><select value={newSubject.semester_group} onChange={e=>setNewSubject({...newSubject,semester_group:e.target.value})}><option value='SEM2'>SEM2</option><option value='SEM4'>SEM4</option><option value='OPEN'>OPEN</option></select><label><input type='checkbox' checked={newSubject.is_heavy} onChange={e=>setNewSubject({...newSubject,is_heavy:e.target.checked})}/>Pesada</label><button onClick={createSubject}>Agregar</button></div>{subjects.map(s=><div className='row item' key={s.id}><span>{s.name} ({s.semester_group})</span><button onClick={async()=>{await api.patch(`/subjects/${s.id}/`,{is_heavy:!s.is_heavy});load()}}>Toggle pesada</button><button onClick={async()=>{await api.delete(`/subjects/${s.id}/`);load()}}>Eliminar</button></div>)}</div>
  </div>
}
