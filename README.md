# React + NestJS

проект с использованием React на фронтенде и NestJS на бэкенде


## 🛠️ Требования
- `Node.js >= 18`
- `Yarn >= 1.22`


## ⚙️ Установка зависимостей
Необходимо по отдельности перейти в клиентскую и серверную часть проекта и использовать команду:
`yarn install`


## ▶️ Запуск проекта

### - Клиент (React):
`cd client`

**Запуск в режиме разработки:**
`yarn dev`

**Сборка для продакшена:**
`yarn build`

**Просмотр продакшн-сборки:**
`yarn preview`

### - Сервер (NestJS)
`cd server`

**Запуск в режиме разработки:**
`yarn start:dev`

**Сборка проекта:**
`yarn build`

**Запуск в продакшене:**
`yarn start`


## 🌍 Переменные окружения

### - Для сервера (server/.env)
`DATABASE_URL=postgresql://username:password@localhost:5432/dbname`

`JWT_SECRET=your_secret_key`

### - Для клиента (client/.env):
`API_BASE_URL="http://localhost:5000/api";`
