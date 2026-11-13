# Omnes

**Tus finanzas y presupuestos, cotizados con IA.**

Omnes es una aplicación web para armar y ejecutar presupuestos. Subes la planilla Excel de un presupuesto (por ejemplo, para abrir un local) y la IA hace dos cosas:
- **Clasifica cada ítem** como **activo** (algo que se compra) o **pasivo** (un gasto fijo).
- **Cotiza los activos en internet,** con el rango de precio, la mejor opción, los proveedores, las fuentes consultadas y la fecha.

Después puedes llevar ese presupuesto a tu **billetera** para ejecutarlo y ajustarlo. Los **reportes** muestran cuánto se aleja el monto estimado del precio de mercado. Omnes planifica y cotiza: no maneja dinero real.

- **URL pública:** https://omnes-api-vyissim.azurewebsites.net
- **Proyecto:** Taller de Ingeniería de Software, Universidad San Sebastián.

## Funcionalidades

| Módulo | Qué hace |
|---|---|
| **Inicio: presupuestos con IA** | Sube un Excel (`Nombre \| Categoría \| Monto estimado`, máximo 50 ítems) o **describe tu proyecto** ("una pollería pequeña para 20 personas") y la IA arma una lista que revisas y editas antes de guardarla (máximo 10 por día). Con el Excel, la IA clasifica cada ítem como activo o pasivo, y tú puedes corregirlo. "Generar presupuesto actualizado" cotiza con búsqueda web los activos que aún no tienen precio, de 5 en 5 y con barra de progreso; "Actualizar todos los precios" vuelve a cotizarlos todos. **"¿Qué me falta?"** se abre como una barra de búsqueda: escribes qué quieres lograr ("duplicar la venta de papas y pollos") y la IA recomienda equipos e insumos concretos para eso (el objetivo es obligatorio: vacía, no se envía). Cada sugerencia trae su motivo y eliges cuáles agregar (máximo 10 revisiones por día). Se descarga en Excel. Cada presupuesto se puede abrir, renombrar o borrar. |
| **Billetera** | El **presupuesto planificado**: los ítems del presupuesto en ejecución, editables sin cambiar el original, con su total, activos y pasivos, y la comparación con el precio de mercado que encontró la IA. |
| **Reportes** | Para cualquier presupuesto: monto estimado vs. precio de mercado (con aviso de cotizaciones dudosas), presupuesto por categoría y activos vs. pasivos. |
| **Trabajadores** | El administrador crea cuentas de trabajador. Roles: Admin y Trabajador. |

## Stack

- **Backend:** ASP.NET Core 8 Web API, Entity Framework Core, PostgreSQL (Npgsql) y JWT para autenticación.
- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS 4, Recharts, React Router y lucide-react. Tema oscuro: fondo `#111217`, texto `#DFE5EB` y rojo `#EF233C` para lo importante, todos definidos en `frontend/frontend/src/index.css`.
- **IA:** Microsoft Foundry, modelo `gpt-5-mini` con búsqueda web. La clave solo vive en el backend.
- **Nube:** Azure App Service (Linux) y Azure Database for PostgreSQL Flexible Server, en la región Chile Central.

## Estructura

```
backend/
  TaskFlow.Api/          API REST (.NET 8): Controllers, Services, Models, Dtos, Migrations
  TaskFlow.Api.Tests/    Pruebas unitarias (xUnit)
  azure-pipelines.yml    Pipeline del backend
frontend/
  frontend/              SPA (React + TS + Vite)
  .husky/                Git hooks (Husky)
  azure-pipelines.yml    Pipeline del frontend
deploy-azure.ps1         Despliegue a Azure App Service
```

## Requisitos previos

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 20+](https://nodejs.org)
- PostgreSQL 14+ corriendo localmente o en un servidor remoto

## Backend

1. **Crea la base de datos** PostgreSQL, por ejemplo `taskflow_dev`.
2. **Ajusta la conexión si hace falta.** Si tu base no es la local por defecto, cambia la cadena de conexión en `backend/TaskFlow.Api/appsettings.Development.json` (`ConnectionStrings:DefaultConnection`). No escribas contraseñas ahí; usa `dotnet user-secrets`.
3. **Configura los secretos locales** desde `backend/TaskFlow.Api`. El repositorio no incluye claves y, sin `Jwt:Key`, la API no arranca. En producción van como App Settings (`Jwt__Key`, `Foundry__ApiKey`).

   ```bash
   dotnet user-secrets set "Jwt:Key" "una-clave-propia-de-al-menos-32-caracteres"
   dotnet user-secrets set "Foundry:ApiKey" "la-key-de-microsoft-foundry"
   ```

4. **Ejecuta la API:**

   ```bash
   cd backend/TaskFlow.Api
   dotnet run
   ```

La API queda en `http://localhost:5146`, con Swagger en `/swagger`. Las migraciones se aplican solas al iniciar (`db.Database.Migrate()` en `Program.cs`).

**Pruebas:**

```bash
cd backend
dotnet test TaskFlow.Api.Tests
```

## Frontend

```bash
cd frontend/frontend
npm install
npm run dev
```

Por defecto apunta a `http://localhost:5146/api` (variable `VITE_API_URL` en `frontend/frontend/.env`). Abre `http://localhost:5173`.

## Historias de usuario

Se gestionan en **Azure Boards** (proyecto *taller ing software*).

| Épica | Feature | Historias | Estado |
|---|---|---|---|
| Presupuestos cotizados con IA | Carga y gestión de presupuestos | US-26 a US-30 | ✅ |
| | Cotización con IA | US-31 a US-33 | ✅ |
| Billetera | Presupuesto planificado en la billetera | US-34 a US-36 | ✅ |
| Métricas y reportes visuales | Reportes del presupuesto en ejecución | US-39 a US-41 | ✅ |

**Retiradas en la versión actual:**
- El módulo de tareas, hábitos y calendario (US-01 a US-09) y sus reportes de productividad (US-21 a US-23).
- Las finanzas personales de la billetera: saldo y movimientos (US-10 a US-13), límite de gasto mensual con alerta (US-14 a US-16), ahorros y metas (US-17 a US-19), el resumen de la billetera (US-37) y la devolución de ahorros (US-38). Omnes no maneja dinero real, así que la billetera quedó solo con el presupuesto en ejecución.
- Los gráficos de ahorro real vs. planificado (US-24) y de gastos por categoría (US-25), reemplazados por los reportes US-39 a US-41.

## Calidad y seguridad

- **Husky (Git hooks):** cada integrante los tiene activos al correr `npm install`.
  - `commit-msg`: exige un mensaje de al menos 5 caracteres.
  - `pre-commit`: corre el linter (oxlint).
  - `pre-push`: verifica que TypeScript compile.
  - `post-checkout` y `post-merge`: ejecutan `npm install` si cambió `package-lock.json`.
- **Pipelines en Azure DevOps:** se ejecutan en cada push a `main` y se muestran como una línea de tiempo por etapas.
  - **Backend:** "Compilar y probar" (build, pruebas xUnit, cobertura y **SonarCloud**) y luego, en paralelo, "Seguridad" (**OWASP ZAP** sobre la app publicada) y "Rendimiento" (**Apache JMeter**).
  - **Frontend:** "Compilar" (`npm ci`, revisión de tipos y build) y luego "Calidad" (**Google Lighthouse**, con Lighthouse CI en versión fija e instalado sin scripts de instalación).
  - Cada ejecución deja reportes descargables: cobertura, `ZAPSecurityReport`, `JMeterReport` y `LighthouseReport`.
- **Prueba de carga (Apache JMeter):** el plan está en `backend/performance/omnes.jmx`.
  - Simula **50 usuarios durante 1 minuto** que inician sesión y recorren Inicio, un presupuesto, la Billetera y Reportes. No llama a la IA, para no gastar crédito.
  - En el pipeline corre contra una copia de la API levantada en el mismo agente, con una base PostgreSQL temporal: nunca carga la app real ni deja datos en ella.
  - La etapa falla si más del 1 % de las peticiones da error o si el percentil 95 supera los 2 segundos (`backend/performance/check_results.py`).
  - En local: `jmeter -n -t backend/performance/omnes.jmx -l resultados.jtl -e -o reporte -Jport=5146` (parámetros `users`, `rampup`, `duration`).
- **Seguridad de la API:**
  - JWT con clave validada al arrancar.
  - Cada usuario ve solo sus datos.
  - Cabeceras OWASP: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy y Permissions-Policy.
  - HSTS activado y la cabecera `Server` oculta.

## Autenticación

La API es multiusuario: cada cuenta tiene sus propios presupuestos y su propia billetera (el presupuesto en ejecución). El login devuelve un JWT que el frontend guarda en `localStorage` y envía en el header `Authorization`.

## Repositorios

- **GitHub** `Y1SS1/omnes` (`main`): el repositorio principal.
- **Azure DevOps:** `taller-back` contiene la carpeta `backend/` y `taller-front` la carpeta `frontend/`. Cada uno tiene su propio pipeline.

## Despliegue en Azure

La app se despliega como **un solo App Service** que sirve la API y también el frontend ya compilado, desde `wwwroot/`. Así no hace falta configurar CORS entre dos servidores.

- **URL pública:** https://omnes-api-vyissim.azurewebsites.net
- **Resource group:** `rg-omnes` (región `chilecentral`).
- **App Service:** `omnes-api-vyissim` (plan `plan-omnes`, Linux B1).
- **Base de datos:** `omnes-db-vyissim` (Azure Database for PostgreSQL Flexible Server), base `taskflow`.
- **Configuración:** la cadena de conexión, `Jwt:Key`, `Foundry:ApiKey`, CORS y `ASPNETCORE_ENVIRONMENT=Production` están en las App Settings del App Service, no en el repositorio.

Para volver a desplegar después de hacer cambios:

```powershell
.\deploy-azure.ps1
```

Requiere tener `az login` hecho con la cuenta que tiene acceso al resource group. La página principal no queda guardada en la caché del navegador, así que cada despliegue se ve de inmediato.
