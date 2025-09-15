# CollabNotes - Fullstack Collaboration App

A comprehensive collaboration platform designed for companies with hierarchical structure support.

## 🏗️ Architecture

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: JWT-based auth system

## 🏢 System Roles & Structure

### Super Admin (Company Account)
- Registers a new company
- Manages company-wide settings
- Creates departments

### Department Admin (Head of Department)
- Assigned by the super admin
- Manages members within the department
- Creates notes, tasks, and projects for that department

### Users (Employees)
- Belong to exactly one department
- Can collaborate on notes, tasks, and projects

## 📂 Project Structure

```
CollabNotes/
├── frontend/          # React + Vite + Tailwind
├── backend/           # Node.js + Express API
├── README.md
└── .gitignore
```

## 🚀 Getting Started

### Backend Setup
```bash
cd backend
npm install
# Configure your .env file
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 🗄️ Database Schema

- **Company**: Company information and settings
- **Department**: Organizational departments
- **User**: System users with role-based access
- **Note**: Collaborative notes within departments
- **Task**: Task management with status tracking
- **ActivityLog**: System activity tracking

## 🔌 API Endpoints

### Authentication
- `POST /auth/register-company` - Register new company
- `POST /auth/login` - User login

### Companies & Departments
- `GET /companies/:id` - Get company details
- `POST /companies/:id/departments` - Create department
- `GET /companies/:id/departments` - List departments

### Notes & Tasks
- CRUD operations scoped by department
- Real-time collaboration (WebSocket integration planned)

## 🎨 Frontend Pages

- **Landing Page** (`/`) - Company registration/login
- **Dashboard** (`/company`) - Super admin company management
- **Department Dashboard** (`/department/:id`) - Department overview
- **Notes Editor** (`/department/:id/notes/:noteId`) - Collaborative editing
- **Tasks Board** (`/department/:id/tasks`) - Kanban-style task management
- **User Profile** (`/profile`) - Personal settings

## 📝 Development Status

This project is currently under development. Features are being implemented incrementally.