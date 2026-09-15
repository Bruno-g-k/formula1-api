# 🏁 Quick Start - Fórmula 1 API

## ⚡ Comece em 3 passos

### 1️⃣ Instale Docker
Se não tiver, baixe em: https://www.docker.com/products/docker-desktop

### 2️⃣ Rode tudo
```bash
cd formula1-api
docker compose up --build
```

### 3️⃣ Teste
```bash
# Listar pilotos
curl http://localhost:8080/api/pilots | jq

# Criar piloto
curl -X POST http://localhost:8080/api/pilots \
  -H "Content-Type: application/json" \
  -d '{"name":"Your Name","number":99,"team":"Your Team"}'
```

---

## 🔗 Links Úteis

| Serviço | URL | Credenciais |
|---|---|---|
| 🚪 **API Gateway** | http://localhost:8080 | - |
| 🐰 **RabbitMQ Console** | http://localhost:15672 | admin/password123 |
| 🔍 **MongoDB** | mongodb://localhost:27017 | admin/password123 |
| 📊 **Gateway Health** | http://localhost:8080/health | - |
| 📈 **Gateway Metrics** | http://localhost:8080/api/gateway/metrics | - |

---

## 📚 Documentação Completa

- **[README.md](README.md)** - Documentação principal (operação, endpoints, requisitos)
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Explicação detalhada de design e padrões
- **[USAGE.md](USAGE.md)** - Roteiro de apresentação em sala

---

## 🧪 Testes Rápidos

### Load Balancing (Round Robin)
```bash
for i in {1..9}; do
  curl -s http://localhost:8080/api/pilots | jq '.servedBy'
done
```
Deve alternar entre `backend-1`, `backend-2`, `backend-3`

### Rate Limiting
```bash
for i in {1..25}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/pilots
done
```
Primeiras 20: `200`, próximas 5: `429`

### RabbitMQ - Criar Piloto
```bash
curl -X POST http://localhost:8080/api/pilots \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Driver","number":88,"team":"Test Team"}'

# Ver evento processado
docker logs -f formula1-event-consumer
```

---

## 🛑 Parar Tudo

```bash
docker compose down
```

Com volumes:
```bash
docker compose down -v
```

---

## 🏗️ O Que Foi Implementado?

✅ **API RESTful com CRUD**
- 3 entidades: Pilotos, Equipes, Corridas
- Operações: Create, Read, Update, Delete
- Persistência: MongoDB

✅ **Opção A: API Gateway + Rate Limit + Load Balancer**
- Rate Limit: 20 req/10s por IP
- Load Balancing: Round Robin entre 3 backends
- Health Check automático
- Failover transparente

✅ **Opção B: RabbitMQ + Mensageria**
- 3 Filas: race-events, pilot-updates, gateway-metrics
- Event Consumer processando eventos
- Auditoria de eventos em MongoDB
- Garantia de entrega (persistent)

✅ **Docker & Orquestração**
- 7 containers: mongodb, rabbitmq, backend1/2/3, event-consumer, gateway
- `docker-compose.yml` único
- Health checks integrados
- Inicialização automática

---

## 📋 Estrutura de Arquivos

```
formula1-api/
├── docker-compose.yml          ← Orquestração (TUDO EM UM ARQUIVO!)
├── init-db.js                  ← Dados iniciais
├── README.md                   ← Documentação principal
├── ARCHITECTURE.md             ← Decisões de design
├── USAGE.md                    ← Roteiro de apresentação
├── .env.example                ← Variáveis de ambiente
├── .gitignore                  ← Git ignore
│
├── backend/                    ← API (3 réplicas via compose)
│   ├── app.js                  ← Express + MongoDB + RabbitMQ
│   ├── Dockerfile              ← Container backend
│   ├── package.json            ← Dependências
│   └── README.md
│
├── gateway/                    ← API Gateway
│   ├── app.js                  ← Rate limit + Load balancer
│   ├── Dockerfile              ← Container gateway
│   ├── package.json
│   └── README.md
│
└── event-consumer/             ← Message Listener
    ├── consumer.js             ← RabbitMQ consumer
    ├── Dockerfile              ← Container consumer
    └── package.json
```

---

## 🎓 O Que Você Aprendeu?

1. **API Gateway** - Centralizar roteamento, rate limit, logging
2. **Load Balancing** - Distribuir requisições entre múltiplos backends
3. **Health Checks** - Detectar e retirar backends indisponíveis
4. **Pub/Sub Messaging** - Desaclopar componentes com RabbitMQ
5. **Event-Driven Architecture** - Processamento assíncrono
6. **Docker & Compose** - Orquestração de múltiplos serviços
7. **Padrões de Design Distribuído** - Bulkhead, Failover, etc.

---

## 🚀 Próximos Passos (Extras)

Se quiser expandir o projeto:

1. **Adicionar autenticação JWT** no gateway
2. **Implementar circuit breaker** pattern
3. **Adicionar métricas** com Prometheus
4. **Integrar Grafana** para dashboards
5. **Usar Loki** para log centralizado
6. **Migrar para Kubernetes**
7. **Adicionar testes** (Jest, Supertest)

---

## ❓ Dúvidas?

Consulte:
- `ARCHITECTURE.md` para entender design
- `USAGE.md` para guia de apresentação
- `docker logs -f <container>` para debugging

---

**Boa sorte na apresentação! 🏁**

Dúvidas? Consulte os arquivos de documentação incluídos.
