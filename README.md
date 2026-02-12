# FIUNA – Planificador de Exámenes (MVP)

Proyecto full-stack para planificar fechas de exámenes del Departamento de Ciencias Básicas.

## Estructura
- `backend/`: Django + DRF + SQLite
- `frontend/`: React + Vite + TypeScript + FullCalendar

## Backend
### Requisitos
- Python 3.12+

### Instalación
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Datos demo
```bash
python manage.py seed_demo
```
Usuario demo: `admin / admin123`.

### Auth y CORS
- Autenticación: **SessionAuthentication** de DRF (`/api/auth/login/`, `/api/auth/logout/`, `/api/auth/me/`).
- Endpoints protegidos con login.
- CORS habilitado para `http://localhost:5173`.

## Frontend
### Requisitos
- Node 20+

### Instalación
```bash
cd frontend
npm install
npm run dev
```

## Endpoints principales
- CRUD asignaturas: `/api/subjects/`
- Calendarios y acciones:
  - `/api/calendars/`
  - `/api/calendars/{id}/assign_event/`
  - `/api/calendars/{id}/toggle_blocked_day/`
  - `/api/calendars/{id}/save_version/`
  - `/api/calendars/{id}/restore_version/{version_id}/`
  - `/api/calendars/{id}/export/excel/?version_id=`
  - `/api/calendars/{id}/export/pdf/?version_id=`
- Reglas: `/api/rules/`
- Versiones: `/api/versions/`

## Notas
- Validación authoritative en backend (hard/soft).
- Domingos y feriados/bloqueos son hard.
- Soporta reglas SAME_DAY, PREFER_SAME_DAY y HEAVY_NOT_SAME_DAY.
