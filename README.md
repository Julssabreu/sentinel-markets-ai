# Sentinel Markets AI

Ubicacion oficial de desarrollo: `C:\Users\ADMIN\Desktop\sentinel market ai\source`.

## Estado 0.3.2

- Primera capa segura de datos reales mediante IPC de Electron.
- BTC/USD: precio y variacion de 24 horas desde Binance Spot (endpoint publico de solo mercado).
- EUR/USD: tasa de referencia diaria del BCE mediante Frankfurter.
- La interfaz separa precios reales de señales y analisis demostrativos.
- Sin ejecucion de operaciones ni acceso a cuentas.

Estas fuentes iniciales prueban la arquitectura de conectores; no forman todavia un motor de recomendaciones.

## Entregas

Cada version funcional se entrega como un unico instalador `.exe` en la carpeta principal del proyecto.

Primera versión funcional del Centro de Análisis Financiero Personal Global.

## Estado

- Interfaz y cálculos iniciales funcionales.
- Todos los precios, señales y noticias visibles son **datos demostrativos**.
- No ejecuta operaciones ni se conecta todavía a cuentas financieras.

## Desarrollo

```powershell
npm install
npm run dev
```

## Validación

```powershell
npm test
npm run build
```

## Crear instalador de Windows

```powershell
npm run dist:win
```

El instalador se genera en `release/`.

## Próxima etapa

1. Persistencia local cifrada y catálogo universal de instrumentos.
2. Conectores de solo lectura: MT5, eToro y fuentes oficiales.
3. Normalización, procedencia y control de calidad de datos.
4. Motor cuantitativo, macro, noticias, estrategias y backtesting.
5. Chat Julssbot conectado exclusivamente a datos verificados.

## Consenso de proveedores

Sentinel normaliza varias cotizaciones del mismo instrumento (por ejemplo,
OANDA:EURUSD, FXCM:EURUSD y Pepperstone:EURUSD) bajo una identidad universal
EUR/USD. El motor calcula una referencia robusta, spread, dispersión y feeds
atípicos. Estas fuentes enriquecen el análisis, pero el precio operativo y el
cálculo de riesgo siempre proceden del bróker conectado en MT5.

La integración con TradingView debe usar mecanismos permitidos (exportaciones,
alertas/webhooks o integraciones autorizadas); Sentinel no dependerá de scraping
frágil ni de credenciales del usuario.
# Política de proveedores premium

Sentinel incluye en su arquitectura conectores previstos para X API, Reuters Connect, AlphaSense y otros proveedores profesionales. Permanecen desactivados hasta contar con licencia, credenciales y aprobación explícita de gasto. Ningún conector puede comprar créditos, contratar planes ni generar consumo facturable automáticamente. La aplicación debe conservar una ruta gratuita funcional y mostrar procedencia, coste y valor añadido de cada fuente.
