import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { api } from './api'
import { HomePage } from './pages/HomePage'
import { CalendarPage } from './pages/CalendarPage'

function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const submit = async () => {
    await api.post('/auth/login/', { username, password })
    navigate('/')
    window.location.reload()
  }
  return <div className='login'><h2>Ingreso</h2><input value={username} onChange={e=>setUsername(e.target.value)} /><input type='password' value={password} onChange={e=>setPassword(e.target.value)} /><button onClick={submit}>Entrar</button></div>
}

export default function App() {
  const [me, setMe] = useState<any>(null)
  useEffect(() => { api.get('/auth/me/').then(r => setMe(r.data)).catch(()=>setMe(false)) }, [])
  if (me === null) return <div>Cargando...</div>
  if (me === false) return <Login />

  return (
    <div>
      <nav className='navbar'>FIUNA – Planificador de Exámenes (Ciencias Básicas)</nav>
      <Routes>
        <Route path='/' element={<HomePage />} />
        <Route path='/calendars/:id' element={<CalendarPage />} />
        <Route path='/calendar/:id' element={<CalendarPage />} />
        <Route path='*' element={<Navigate to='/' />} />
      </Routes>
    </div>
  )
}
