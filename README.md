# Car Dashboard

Проект состоит из:
- `frontend` (React + Vite)
- `backend` (Node 24 + парсер Encar + API)
- `MySQL` в Docker для хранения машин и истории цен

## Почему MySQL

Для этой задачи MySQL подходит хорошо:
- простое и стабильное хранение табличных данных (`cars`, `car_price_history`);
- удобные `UPSERT` через `ON DUPLICATE KEY UPDATE`;
- легко поднять локально в Docker.

## Быстрый старт

1. Установить зависимости:

```bash
npm install
npm --prefix backend install
```

2. Поднять БД:

```bash
npm run db:up
```

3. Запустить backend:

```bash
npm run backend
```

4. Запустить frontend:

```bash
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:3001`

## Переменные backend

Пример в `backend/.env.example`:

```env
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=car_user
DB_PASSWORD=car_password
DB_NAME=car_dashboard
```

## API

- `GET /api/cars`  
  Читает данные из БД. Если БД пустая, backend сначала делает парсинг и сохраняет данные.

- `GET /api/cars?refresh=1`  
  Форсирует новый парсинг и обновляет БД.

- `POST /api/sync`  
  Явный запуск парсинга и сохранения в БД.

## История цен

Backend хранит:
- актуальную цену в `cars`;
- историю изменений в `car_price_history`.

Frontend получает вместе с машиной:
- `previousPrice`
- `priceDelta`
- `priceTrend` (`up` | `down` | `same`)

и показывает рост/падение цены в таблице.
