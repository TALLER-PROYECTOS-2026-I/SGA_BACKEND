# 📌 Proyecto Core-Gestion

Este proyecto utiliza **Azure Functions** en **Node.js** con conexión a **PostgreSQL** usando `pg`,
gestiona variables de entorno con `dotenv` y aplica migraciones con **Drizzle ORM**.

---

## 🛠 Requisitos previos

Antes de instalar y correr el proyecto, asegúrate de tener:

- **Node.js** v22.18.0  
  [Descargar Node.js](https://nodejs.org/en/)  
  Verificar versión:

  ```bash
  node -v
  ```

- **Azure Functions Core Tools v4**

  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  npm install -g azure-functions-core-tools@4 --unsafe-perm true
  func --version
  ```

- **Azure CLI**  
  Instalar desde [Azure CLI MSI (Windows 64bits)](https://learn.microsoft.com/es-es/cli/azure/install-azure-cli-windows?view=azure-cli-latest&pivots=msi)

Dependencias principales instaladas en el proyecto:

```json
"dependencies": {
  "@azure/functions": "^4.0.0",
  "dotenv": "^17.2.1",
  "pg": "^8.16.3"
}
```

## 🚀 Despliegue y ejecución

Para correr el proyecto en local:

```bash
npm run start
```

En caso de errores, verificar que se compile la carpeta /dist y ejecutar:

```bash
npm run start
func start
```

Comando para generar credenciales en Azure clie (lideres - pruebas independientes), recomendacion: utilizar "azure functions consumption plan":

```bash
az ad sp create-for-rbac --name "github-actions-coregestion" --role "Contributor" --scopes "/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP>" --sdk-auth
```

---

---

## ⚡ Scripts de inicialización configurados en el proyecto

- **Instalar dependencias**

  ```bash
  npm install
  ```

- **Compilar proyecto**

  ```bash
  npm run build
  ```

- **Ejecutar en modo watch**

  ```bash
  npm run watch
  ```

- **Iniciar proyecto en local**

  ```bash
  npm run start
  ```

- **Verificar formato con Prettier**

  ```bash
  npm run format:check
  ```

- **Formatear con Prettier**

  ```bash
  npm run format:write
  ```

- **Ejecutar pruebas con Jest**
  ```bash
  npm run test
  ```

---

## ⚠️ Errores comunes y soluciones

### 1. Error: `func : El término 'func' no se reconoce`

➡️ Significa que no tienes instalado **Azure Functions Core Tools** o no está en el `PATH`.  
✅ Solución: Reinstalar con:

```bash
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

### 2. Error: `npm : El término 'npm' no se reconoce`

➡️ Node.js no está instalado correctamente o no está agregado al `PATH`.  
✅ Verificar instalación:

```bash
node -v
npm -v
```

### 3. Error al ejecutar `func start` en PowerShell

➡️ Restricción de ejecución de scripts en Windows.  
✅ Ejecutar:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

npm uninstall azure-functions-core-tools
npm install azure-functions-core-tools@4 --save-dev
```

---

## Patron de diseño arquitectura

Ademas definimos este patron de diseño del proy backend como:
**Arquitectura Serverless basada en Controllers con Attribute-Based Routing sobre Azure Functions**

manejamos

- Serverless MVC-Light con Decorators

- Framework de Controllers para Azure Functions

- Clean Controller Pattern aplicado en entorno Serverless

## Creacion de schema automatico con drizzle

```powershell
npx drizzle-kit introspect --config=drizzle.config.ts

```
## Creacion de schema automatico con drizzle
## Creacion de schema automatico con drizzle
## Creacion de schema automatico con drizzle
