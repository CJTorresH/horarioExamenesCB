import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../api'

type Calendar = {
  id: number
  name: string
  period_type: 'P1' | 'P2' | 'F1' | 'F2'
}

type Subject = {
  id: number
  name: string
  semester_group: 'SEM2' | 'SEM4' | 'OPEN'
  is_heavy: boolean
}

const groupLabel = (group: Subject['semester_group']) => (group === 'OPEN' ? 'Extra' : group)

export function HomePage() {
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])

  const [name, setName] = useState('')
  const [periodType, setPeriodType] = useState<Calendar['period_type']>('P1')

  const [newSubject, setNewSubject] = useState({
    name: '',
    semester_group: 'SEM2' as Subject['semester_group'],
    is_heavy: false,
  })

  const [loadingCalendars, setLoadingCalendars] = useState(false)
  const [loadingSubjects, setLoadingSubjects] = useState(false)
  const [creatingCalendar, setCreatingCalendar] = useState(false)
  const [creatingSubject, setCreatingSubject] = useState(false)
  const [subjectActionId, setSubjectActionId] = useState<number | null>(null)

  const loadCalendars = async () => {
    setLoadingCalendars(true)
    try {
      const response = await api.get<Calendar[]>('/calendars/')
      setCalendars(response.data)
    } catch (error) {
      console.error('Error cargando calendarios:', error)
      toast.error('No se pudieron cargar los calendarios.')
    } finally {
      setLoadingCalendars(false)
    }
  }

  const loadSubjects = async () => {
    setLoadingSubjects(true)
    try {
      const response = await api.get<Subject[]>('/subjects/')
      setSubjects(response.data)
    } catch (error) {
      console.error('Error cargando asignaturas:', error)
      toast.error('No se pudieron cargar las asignaturas.')
    } finally {
      setLoadingSubjects(false)
    }
  }

  const loadData = async () => {
    await Promise.all([loadCalendars(), loadSubjects()])
  }

  useEffect(() => {
    loadData()
  }, [])

  const createCalendar = async () => {
    if (!name.trim()) {
      toast.error('El nombre del calendario es obligatorio.')
      return
    }

    setCreatingCalendar(true)
    try {
      await api.post('/calendars/', {
        name: name.trim(),
        period_type: periodType,
      })
      toast.success('Calendario creado correctamente.')
      setName('')
      setPeriodType('P1')
      await loadCalendars()
    } catch (error) {
      console.error('Error creando calendario:', error)
      toast.error('No se pudo crear el calendario.')
    } finally {
      setCreatingCalendar(false)
    }
  }

  const createSubject = async () => {
    if (!newSubject.name.trim()) {
      toast.error('El nombre de la asignatura es obligatorio.')
      return
    }

    setCreatingSubject(true)
    try {
      await api.post('/subjects/', {
        name: newSubject.name.trim(),
        semester_group: newSubject.semester_group,
        is_heavy: newSubject.is_heavy,
      })
      toast.success('Asignatura creada correctamente.')
      setNewSubject({ name: '', semester_group: 'SEM2', is_heavy: false })
      await loadSubjects()
    } catch (error) {
      console.error('Error creando asignatura:', error)
      toast.error('No se pudo crear la asignatura.')
    } finally {
      setCreatingSubject(false)
    }
  }

  const deleteSubject = async (subjectId: number) => {
    setSubjectActionId(subjectId)
    try {
      await api.delete(`/subjects/${subjectId}/`)
      toast.success('Asignatura eliminada.')
      await loadSubjects()
    } catch (error) {
      console.error(`Error eliminando asignatura ${subjectId}:`, error)
      toast.error('No se pudo eliminar la asignatura.')
    } finally {
      setSubjectActionId(null)
    }
  }

  const toggleHeavy = async (subject: Subject) => {
    setSubjectActionId(subject.id)
    try {
      await api.patch(`/subjects/${subject.id}/`, {
        is_heavy: !subject.is_heavy,
      })
      toast.success('Estado de pesada actualizado.')
      await loadSubjects()
    } catch (error) {
      console.error(`Error actualizando asignatura ${subject.id}:`, error)
      toast.error('No se pudo actualizar la asignatura.')
    } finally {
      setSubjectActionId(null)
    }
  }

  return (
    <div className='page'>
      <div className='card'>
        <h2>Calendarios</h2>
        <div className='row'>
          <input
            placeholder='Nombre del calendario'
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select value={periodType} onChange={(e) => setPeriodType(e.target.value as Calendar['period_type'])}>
            <option value='P1'>Parcial 1</option>
            <option value='P2'>Parcial 2</option>
            <option value='F1'>Final 1</option>
            <option value='F2'>Final 2</option>
          </select>
          <button onClick={createCalendar} disabled={creatingCalendar}>
            {creatingCalendar ? 'Creando...' : 'Nuevo calendario'}
          </button>
        </div>

        {loadingCalendars ? (
          <p>Cargando calendarios...</p>
        ) : (
          calendars.map((calendar) => (
            <Link key={calendar.id} className='calendar-link' to={`/calendar/${calendar.id}`}>
              {calendar.name} - {calendar.period_type}
            </Link>
          ))
        )}
      </div>

      <div className='card'>
        <h2>Asignaturas (CRUD)</h2>
        <div className='row'>
          <input
            placeholder='Nombre'
            value={newSubject.name}
            onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
          />
          <select
            value={newSubject.semester_group}
            onChange={(e) =>
              setNewSubject({ ...newSubject, semester_group: e.target.value as Subject['semester_group'] })
            }
          >
            <option value='SEM2'>SEM2</option>
            <option value='SEM4'>SEM4</option>
            <option value='OPEN'>Extra</option>
          </select>
          <label>
            <input
              type='checkbox'
              checked={newSubject.is_heavy}
              onChange={(e) => setNewSubject({ ...newSubject, is_heavy: e.target.checked })}
            />
            Pesada
          </label>
          <button onClick={createSubject} disabled={creatingSubject}>
            {creatingSubject ? 'Agregando...' : 'Agregar'}
          </button>
        </div>

        {loadingSubjects ? (
          <p>Cargando asignaturas...</p>
        ) : (
          subjects.map((subject) => (
            <div className='row item' key={subject.id}>
              <span>
                {subject.name} ({groupLabel(subject.semester_group)}) - {subject.is_heavy ? 'Pesada' : 'No pesada'}
              </span>
              <button
                onClick={() => toggleHeavy(subject)}
                disabled={subjectActionId === subject.id}
              >
                Toggle pesada
              </button>
              <button
                onClick={() => deleteSubject(subject.id)}
                disabled={subjectActionId === subject.id}
              >
                Eliminar
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
