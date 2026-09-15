# Backend API - Fórmula 1

## Descrição
API RESTful para gerenciar dados de Fórmula 1 (pilotos, equipes, corridas e pontuações).

## Estrutura de Diretórios
```
backend/
├── Dockerfile
├── package.json
├── app.js
├── models/
│   ├── pilot.js
│   ├── team.js
│   ├── race.js
│   └── pointsTable.js
├── routes/
│   ├── pilots.js
│   ├── teams.js
│   ├── races.js
│   └── health.js
└── middleware/
    └── eventPublisher.js
```

## Requisitos Funcionais
- CRUD de Pilotos
- CRUD de Equipes
- CRUD de Corridas
- Publicação de eventos de corrida via RabbitMQ
- Health check

## Porta Padrão
3001 (ou conforme INSTANCE_ID)
