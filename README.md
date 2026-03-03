# Audi A3 Car Dashboard

React 19 + TypeScript + Tailwind CSS + Vite

## Запуск

```bash
npm install
npm run dev
```

Открыть http://localhost:5173

## Структура проекта

```
src/
├── main.tsx                  # Точка входа
├── App.tsx                   # Корневой компонент
├── index.css                 # Tailwind + глобальные стили
│
├── types/
│   └── car.ts                # Типы Car, ConditionType, SortKey, Filters
│
├── data/
│   └── cars.ts               # Данные из Excel + классификация состояния
│
├── utils/
│   ├── format.ts             # Форматирование чисел/цен/км
│   ├── colorMap.ts           # Цвета свотчей
│   └── conditionStyle.ts     # Tailwind-классы для бейджей состояния
│
└── components/
    ├── Dashboard.tsx         # Главный компонент: состояние, фильтрация, сортировка
    ├── CarTable.tsx          # Таблица с сортировкой
    ├── FilterChips.tsx       # Чипы мультивыбора (состояние, цвет)
    ├── RangeFilter.tsx       # Двойной range-слайдер
    ├── StatsBar.tsx          # Статистика (кол-во, средняя цена/пробег)
    └── BodyTooltip.tsx       # Попап кузова при наведении
```

## Замена плейсхолдера в тултипе

В `src/components/BodyTooltip.tsx` найди блок с комментарием  
`{/* Image placeholder */}` и замени на:

```tsx
<img src={`/damage/${car.id}.png`} alt="Схема повреждений" className="w-full h-28 object-contain rounded-xl" />
```
