# Reporte de Calidad, Seguridad y Automatización CI/CD

**Proyecto:** Omnes  
**Rama:** `Y1SS1/ARANA`  
**Stack:** ASP.NET Core 8 (.NET 8) Web API + React 19 / TypeScript + PostgreSQL  
**Entorno de despliegue:** Azure App Service + Azure Pipelines + SonarCloud  

---

## 1. Resumen de Objetivos Cumplidos

En esta sesión se incorporaron las tres herramientas de auditoría externa estándar de la industria solicitadas para la entrega del taller:
1. **SonarQube / SonarCloud (SAST):** Análisis estático de código, detección de vulnerabilidades, code smells y cobertura de pruebas unitarias.
2. **Google Lighthouse:** Auditoría automatizada de Rendimiento (Performance), Accesibilidad (a11y), Buenas Prácticas y SEO en el frontend.
3. **OWASP ZAP (DAST):** Escaneo dinámico de seguridad web sobre la aplicación en ejecución.

Adicionalmente:
* Se calibraron y activaron los **Git Hooks (Husky)** para control de calidad antes de cada commit y push.
* Se blindó el **Backend ASP.NET Core** incorporando cabeceras de seguridad HTTP recomendadas por OWASP y mitigando fugas de información.
* Se actualizaron los **Pipelines de Azure DevOps** para que el docente pueda ver todos los reportes y artefactos directamente en la plataforma.

---

## 2. SonarCloud (Análisis Estático y Cobertura)

### Configuración e integración
* **Organización:** `y1ss1`
* **Proyecto:** `Omnes_Back`
* **Panel en vivo:** [https://sonarcloud.io/dashboard?id=Omnes_Back](https://sonarcloud.io/dashboard?id=Omnes_Back)

### Ejecución
* Se instaló la herramienta global `dotnet-sonarscanner`.
* Se ejecutó el escáner recolectando la cobertura generada por los tests con formato OpenCover:
  ```powershell
  dotnet test backend/TaskFlow.sln --collect:"XPlat Code Coverage;Format=opencover"
  ```
* Se envió exitosamente el reporte a la nube, arrojando **Quality Gate: PASSED**, con análisis de los **63 tests unitarios superados al 100%**.

---

## 3. Corrección y Puesta en Marcha de Git Hooks (Husky)

### Diagnóstico inicial
Los scripts de Husky existían previamente en el repositorio pero se encontraban inactivos por tres motivos:
1. **Rutas:** La configuración de Git (`core.hooksPath`) apuntaba a `frontend/.husky`, pero los archivos físicos se encontraban en `frontend/frontend/.husky`.
2. **Formato en Windows:** Los archivos tenían saltos de línea Windows CRLF (`\r\n`) y carecían de shebang `#!/bin/sh`, lo que impedía que Git for Windows los ejecutara.
3. **Dependencias:** No se había ejecutado `npm install` en la carpeta del frontend, por lo que librerías como el linter (`oxlint`) no estaban disponibles.

### Solución aplicada
1. Se ejecutó `npm install` instalando todas las dependencias del frontend.
2. Se normalizaron todos los scripts con saltos de línea Unix (`LF`) y se agregó el encabezado `#!/bin/sh`.
3. Se hicieron los comandos agnósticos a la ruta, detectando automáticamente si `package.json` está en la raíz, en `frontend/` o en `frontend/frontend/`.
4. Se sincronizaron las carpetas `.husky` en ambas ubicaciones y se vinculó `git config core.hooksPath frontend/.husky`.

### Hooks activos y verificados:
* **`commit-msg`:** Valida que el mensaje de commit no esté vacío ni tenga menos de 5 caracteres. *(Probado en vivo: bloqueó correctamente commits inválidos como "ab")*.
* **`pre-commit`:** Corre automáticamente el linter rápido `oxlint` sobre los 27 componentes y vistas del frontend antes de permitir guardar el commit.
* **`pre-push`:** Corre `npx tsc -b --noEmit` para verificar que el frontend compile sin errores de TypeScript antes de subir cambios remotos.
* **`post-checkout` y `post-merge`:** Detecta si `package-lock.json` sufrió modificaciones y dispara automáticamente `npm install`.

---

## 4. Google Lighthouse (Rendimiento y Accesibilidad)

### Implementación
* Se integró `@lhci/cli` (herramienta oficial de Google para Continuous Integration).
* Se probó localmente la compilación de producción (`npm run build`) seguida de la recolección automática en modo headless contra el directorio `./dist`.
* Genera de forma nativa los archivos `reporte-lighthouse.html` y `.json` conteniendo el desglose de métricas.

### Configuración en Azure Pipelines
En [`frontend/azure-pipelines.yml`](frontend/azure-pipelines.yml) y en el pipeline raíz se agregaron los pasos:
```yaml
- script: npx -y @lhci/cli collect --staticDistDir=dist --numberOfRuns=1
  workingDirectory: frontend/frontend
  displayName: "Run Lighthouse audit"

- task: PublishPipelineArtifact@1
  inputs:
    targetPath: "frontend/frontend/.lighthouseci"
    artifact: "LighthouseReport"
    publishLocation: "pipeline"
  displayName: "Publish Lighthouse report"
```
* **Visibilidad para el docente:** Al finalizar el build en Azure DevOps, se genera el artefacto descargable **`LighthouseReport`** en la pestaña de artefactos.

---

## 5. OWASP ZAP (Seguridad Dinámica DAST)

### Implementación
* Se integró el escaneo de seguridad mediante el contenedor oficial de Docker `ghcr.io/zaproxy/zaproxy:stable`.
* Ejecuta un **Baseline Scan** (`zap-baseline.py`) contra la URL desplegada en producción: `https://omnes-api-vyissim.azurewebsites.net`.
* Inspecciona respuestas HTTP, cabeceras, manejo de cookies y posibles vectores de ataque (XSS, Clickjacking, MIME-sniffing).

### Configuración en Azure Pipelines
En [`backend/azure-pipelines.yml`](backend/azure-pipelines.yml) y en el pipeline raíz se agregaron los pasos:
```yaml
- script: |
    docker run --rm -v $(Build.SourcesDirectory):/zap/wrk/:rw \
      -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
      -t https://omnes-api-vyissim.azurewebsites.net \
      -r zap-report.html -I || true
  displayName: "Run OWASP ZAP Baseline Security Scan"

- task: PublishPipelineArtifact@1
  inputs:
    targetPath: "$(Build.SourcesDirectory)/zap-report.html"
    artifact: "ZAPSecurityReport"
    publishLocation: "pipeline"
  condition: always()
  displayName: "Publish OWASP ZAP Security report"
```
* **Visibilidad para el docente:** Publica el artefacto descargable **`ZAPSecurityReport`** (`zap-report.html`) en la ejecución del pipeline.

---

## 6. Blindaje y Corrección del Backend (`Program.cs`)

Para garantizar que el escaneo de OWASP ZAP no arroje vulnerabilidades de riesgo, se intervino [`backend/TaskFlow.Api/Program.cs`](backend/TaskFlow.Api/Program.cs):

### 1. Ocultamiento de información del servidor
Kestrel (el servidor web de ASP.NET Core) por defecto envía la cabecera `Server: Kestrel`, exponiendo la infraestructura. Se desactivó configurando el WebHost:
```csharp
builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;
});
```

### 2. Activación de HSTS en producción
Fuerza a los navegadores a comunicarse exclusivamente a través de HTTPS:
```csharp
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}
```

### 3. Middleware de Cabeceras de Seguridad OWASP
Se agregó un middleware global que inyecta las defensas recomendadas en cada respuesta HTTP de la API y de los archivos estáticos de la SPA:
```csharp
app.Use(async (context, next) =>
{
    // Evita que navegadores interpreten archivos como un MIME type diferente
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    
    // Evita que la app sea incrustada en un <iframe> (protección contra Clickjacking)
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    
    // Activa el filtro anti-XSS en navegadores legados
    context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
    
    // Evita que se filtren rutas completas al navegar hacia orígenes externos
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    
    // Restringe APIs del dispositivo innecesarias
    context.Response.Headers.Append("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    
    // Política de seguridad de contenido (CSP)
    context.Response.Headers.Append("Content-Security-Policy", 
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;");
    
    await next();
});
```

### Verificación de pruebas
Tras los cambios, se ejecutaron nuevamente las pruebas de regresión:
* **Resultado:** **63 tests superados, 0 fallos, 0 errores**.
* No hubo regresiones en controladores de autenticación, transacciones, ahorros, presupuestos ni reportes.

---

## 7. Resumen de Commits Realizados

Todos los cambios fueron versionados mediante commits descriptivos respetando las convenciones de Conventional Commits:

| Hash | Mensaje | Descripción |
|---|---|---|
| `3f44d64` | `chore(husky): corregir rutas de hooks y compatibilidad multiplataforma` | Configuración base y permisos de ejecución de Husky. |
| `5450127` | `chore(husky): configurar hooks en frontend/.husky y frontend/frontend/.husky` | Sincronización de hooks y vinculación con Git. |
| `e97931a` | `chore: ignorar carpeta de analisis de sonarqube` | Inclusión de `.sonarqube/` y `.lighthouseci/` en `.gitignore`. |
| `afdf73f` | `ci(backend): integrar SonarCloud y reporte dual de cobertura en Azure Pipelines` | Tareas de SonarScanner y Cobertura nativa en pipeline de backend. |
| `bb27207` | `ci(frontend): agregar auditoria automatica de Lighthouse y publicacion de artefacto` | Auditoría Lighthouse y publicación de artefacto en pipeline de frontend. |
| `a3a7516` | `ci(backend): integrar escaneo de seguridad OWASP ZAP y publicacion de artefacto` | Contenedor Docker de ZAP y publicación de artefacto de seguridad. |
| `cac12ae` | `sec(backend): agregar cabeceras de seguridad OWASP y ocultar cabecera Server en Kestrel` | Hardening de `Program.cs` con cabeceras de seguridad HTTP. |
| `8b1faf6` | `ci(root): unificar pipeline principal con SonarCloud, cobertura, Lighthouse y OWASP ZAP` | Actualización del pipeline principal raíz del proyecto. |
