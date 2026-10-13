# Email Tracker

Herramienta propia de envío y seguimiento de correos, pensada para reemplazar
suscripciones como Mailsuite o Mailtrack. Hecha con Next.js (App Router),
MySQL (HostGator / cualquier MySQL 8) y [Resend](https://resend.com) para el
envío.

Incluye: envío individual y por campañas (sin que un destinatario vea a los
demás), pixel de apertura con filtro de bots/escáneres de seguridad, clics en
enlaces, cola con cupo diario (pensada para el plan gratuito de Resend, 100
correos/día), plantillas, contactos tipo CRM con etiquetas, personalización
con variables, editor enriquecido, baja de suscripción (RFC 8058) y manejo de
rebotes/quejas vía webhook, seguimientos automáticos, envíos programados,
reporte semanal por correo, dashboard con estadísticas y modo oscuro.

## Qué necesitás antes de instalar

- Node.js 20+ y npm.
- Una base de datos MySQL 8 accesible desde donde corra la app (HostGator con
  "Remote MySQL" habilitado, o cualquier otro proveedor).
- Una cuenta de [Resend](https://resend.com) con un dominio verificado (o su
  dominio de pruebas) y una API key.
- Un dominio o subdominio propio para que los pixeles y enlaces de tracking no
  dependan de la URL por defecto de Vercel.
- Una cuenta de Vercel (plan Hobby alcanza) si vas a desplegarlo ahí.

## Instalación local

1. Clonar el repo e instalar dependencias:

   ```bash
   git clone https://github.com/Tincholeo/tracking.git
   cd tracking
   npm install
   ```

2. Copiar `.env.local.example` a `.env.local` y completar cada variable (ver
   el detalle de cada una más abajo). El archivo ya trae comentarios
   explicando qué va en cada campo.

3. Crear las tablas: abrir `db/schema.sql` en phpMyAdmin (o el cliente que uses)
   contra la base indicada en `DB_NAME` y ejecutarlo completo. Es seguro
   correrlo sobre una base nueva o ya existente (usa `CREATE TABLE IF NOT
   EXISTS`).

4. Levantar la app:

   ```bash
   npm run dev
   ```

   Entrar a `http://localhost:3000`. Vas a tener que loguearte con
   `ADMIN_USER` / `ADMIN_PASSWORD` (Basic Auth del navegador).

## Variables de entorno

| Variable | Para qué sirve |
|---|---|
| `RESEND_API_KEY` | API key de Resend, para enviar los correos. |
| `RESEND_FROM_EMAIL` | Remitente, formato `"Nombre <correo@tudominio.com>"`. El dominio debe estar verificado en Resend. |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Credenciales de la base MySQL. |
| `NEXT_PUBLIC_BASE_URL` | URL pública de la app. Se usa para armar el pixel de apertura y los links de tracking — debe ser accesible desde internet (no `localhost`) una vez en producción. |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Credenciales del panel (Basic Auth). Elegí una contraseña fuerte: protege el envío de correos y los datos de contactos. |
| `NOTIFY_EMAIL` | Adónde llega el aviso cuando alguien abre un correo por primera vez, y el reporte semanal. |
| `CRON_SECRET` | Token largo y aleatorio que valida las llamadas de Vercel Cron a `/api/cron/*`. Generalo vos mismo (por ejemplo `openssl rand -hex 32`). |
| `ENVIO_LIMITE_DIARIO` | Cupo diario de envíos (100 para el plan gratuito de Resend). |
| `ENVIO_RESERVA_DIARIA` | Cuántos de ese cupo se reservan para avisos de apertura y reportes, en vez de correos de campaña. |
| `RESEND_WEBHOOK_SECRET` | Firma del webhook de Resend (rebotes, quejas, fallos). Se obtiene al crear el webhook en el dashboard de Resend. |

Nunca subas `.env.local` a git — ya está en `.gitignore`. El archivo
`.env.local.example` solo tiene placeholders, es seguro versionarlo.

## Cron jobs (cola de envío y reporte semanal)

`vercel.json` ya trae la configuración necesaria:

- `/api/cron/weekly-report`, los lunes, para el reporte semanal.
- `/api/cron/process-queue`, 24 entradas (una por hora), para ir drenando la
  cola de correos pendientes contra el cupo diario. El plan Hobby de Vercel
  solo permite expresiones cron de una vez por día por entrada, por eso son
  24 líneas en vez de una sola horaria.

Ambos endpoints exigen el header `Authorization: Bearer <CRON_SECRET>`, que
Vercel agrega solo si `CRON_SECRET` está seteado en las variables de entorno
del proyecto.

## Deploy en Vercel

1. Importar el repo en Vercel.
2. Cargar todas las variables de la tabla de arriba en
   **Project Settings → Environment Variables** (usando los valores reales,
   no los de ejemplo).
3. `NEXT_PUBLIC_BASE_URL` debe apuntar al dominio final de producción (el de
   Vercel o uno propio), porque queda embebido en los pixeles y enlaces de
   los correos que ya se enviaron.
4. Si usás un dominio propio para el tracking, agregalo en **Project
   Settings → Domains** y creá el registro CNAME correspondiente en el DNS de
   tu proveedor (sin tocar los nameservers del dominio).
5. En Resend, crear el webhook apuntando a
   `https://tu-dominio/api/webhooks/resend` (eventos: bounced, complained,
   suppressed, failed) y copiar el secreto generado a
   `RESEND_WEBHOOK_SECRET`.
6. Verificar que las credenciales de MySQL tengan acceso remoto habilitado
   desde las IPs de Vercel (en HostGator: cPanel → Remote MySQL).

## Privacidad y datos que se guardan

Esta app registra, por cada correo enviado: destinatario, asunto, cuerpo,
fecha de envío, y por cada apertura o clic, la IP y el user-agent de quien lo
abrió o clickeó (usados solo para distinguir aperturas reales de escáneres
automáticos de seguridad, y para mostrar el tipo de dispositivo). Esos datos
quedan en tu propia base de datos; la app no los comparte con terceros.

Si vas a usar esta herramienta para enviar correos a destinatarios reales,
sos responsable de cumplir con la normativa de protección de datos y
correo no solicitado que te aplique (por ejemplo, informar en tu política de
privacidad que se registra la apertura/clics, y ofrecer la baja de
suscripción que la app ya genera).

## Licencia

MIT. Ver [LICENSE](LICENSE).
