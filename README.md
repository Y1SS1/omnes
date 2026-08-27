# TaskFlow

Organizador de vida y tareas + billetera virtual + métricas, con backend en ASP.NET Core y frontend en React. Implementa las historias de usuario descritas en el documento "Reporte sobre US (User Story)" (3 épicas, 24 historias).

## Stack

- **Backend:** ASP.NET Core 8 Web API, Entity Framework Core, PostgreSQL (Npgsql), JWT para autenticación.
- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS, Recharts, React Router.
- **Base de datos:** PostgreSQL.

## Estructura

```
backend/TaskFlow.Api/   API REST (.NET 8)
frontend/               SPA (React + TS + Vite)
```

## Requisitos previos

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 20+](https://nodejs.org)
- PostgreSQL 14+ corriendo localmente (o remoto)

## Backend

1. Crea una base de datos PostgreSQL (por ejemplo `taskflow_dev`).
2. Ajusta la cadena de conexión en `backend/TaskFlow.Api/appsettings.json` (`ConnectionStrings:DefaultConnection`) con tu host/usuario/contraseña.
3. **Cambia `Jwt:Key`** en `appsettings.json` por un valor propio antes de desplegar a producción (el valor incluido es solo para desarrollo local). En producción, usa variables de entorno o Azure App Configuration/Key Vault en vez de dejarlo en el archivo.
4. Ejecuta:

```bash
cd backend/TaskFlow.Api
dotnet ef database update   # aplica las migraciones (crea las tablas)
dotnet run
```

La API queda disponible en `http://localhost:5146` (Swagger en `/swagger`). Las migraciones también se aplican automáticamente al iniciar la app (`db.Database.Migrate()` en `Program.cs`).

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Por defecto apunta a `http://localhost:5146/api` (ver `frontend/.env`, variable `VITE_API_URL`). Abre `http://localhost:5173`.

## Cobertura de historias de usuario

| Épica | Feature | Historias | Estado |
|---|---|---|---|
| 1. Organizador de vida y tareas | Clasificador y plazos | US-01, US-02 | ✅ |
| | Hábitos repetitivos | US-03, US-04, US-05 | ✅ |
| | Alertas y notificaciones | US-06, US-07 | ✅ (in-app; ver nota abajo) |
| | Calendario por colores | US-08, US-09 | ✅ |
| 2. Billetera virtual | Saldo y egresos | US-10 a US-13 | ✅ |
| | Presupuesto y proyección | US-14 a US-16 | ✅ |
| | Ahorros y calculadoras | US-17 a US-19 | ✅ |
| 3. Métricas y reportes | Productividad | US-21, US-22, US-23 | ✅ |
| | Financiero | US-24, US-25 | ✅ |

### Nota sobre notificaciones push (US-07)

El entorno de desarrollo no tiene credenciales de Apple Push Notification service (APNs) ni Firebase, así que US-07 se implementó como **notificación in-app** (campana en el header, con el mismo texto: "No olvides hacer: [tarea] a las [hora] horas"), generada por un `BackgroundService` que revisa recordatorios vencidos cada 30 segundos. Para enviar push reales a iPhone, habría que:

1. Registrar la app en Apple Developer y obtener un certificado/token APNs (o usar Firebase Cloud Messaging como intermediario).
2. Guardar el device token del usuario al iniciar sesión en la app móvil.
3. En `ReminderNotificationService`, además de crear la `Notification` en base de datos, llamar al servicio de push con ese token.

## Autenticación

La API es multiusuario: cada cuenta tiene su propia billetera, categorías (con colores por defecto) y tareas. El login devuelve un JWT que el frontend guarda en `localStorage` y envía en el header `Authorization`.

## Azure DevOps

Este repositorio está pensado para vivir en Azure DevOps Repos, con un pipeline de compilación (`azure-pipelines.yml` en la raíz) que valida el build del backend y del frontend en cada push.
