# 🏎️ Fórmula 1 API - Projeto de Distribuição e Infraestrutura

**Implementação de uma API RESTful para gerenciar dados de Fórmula 1 com persistência em banco de dados, API Gateway, balanceamento de carga e mensageria.**

## 📋 Índice

- [Objetivo](#objetivo)
- [Arquitetura](#arquitetura)
- [Tecnologias](#tecnologias)
- [Pré-requisitos](#pré-requisitos)
- [Como Executar](#como-executar)
- [Endpoints da API](#endpoints-da-api)
- [Opções Implementadas](#opções-implementadas)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Decisões de Arquitetura](#decisões-de-arquitetura)

---

## 🎯 Objetivo

Desenvolver uma aplicação backend que exponha uma **API RESTful** com:
1. ✅ **Persistência de dados** em MongoDB
2. ✅ **API Gateway** com rate limiting e load balancing
3. ✅ **Sistema de mensageria** com RabbitMQ
4. ✅ **Orquestração completa** com Docker Compose

---

## 🏗️ Arquitetura

```
┌────────────────────────────────────────────────────┐
│                   Cliente HTTP                     │
└─────────────────────┬────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │    API Gateway         │  :8080
         │  - Rate Limiting       │
         │  - Load Balancing      │
         │  - RabbitMQ Publisher  │
         └────────┬───────┬───────┘
                  │       │
        ┌─────────┘       └──────────┐
        ▼                            ▼
   ┌─────────────┐          ┌──────────────┐
   │  Backend-1  │          │  Backend-2   │  :3001-3003
   │  :3001      │ ◄─────► │  :3002       │
   │  (Express)  │          │  (Express)   │
   └─────────────┘          └──────────────┘
        │                            │
        └──────────────┬─────────────┘
                       ▼
             ┌───────────────────┐
             │   Backend-3       │
             │   :3003           │
             │   (Express)       │
             └─────────┬─────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
   ┌──────────┐                  ┌──────────────┐
   │ MongoDB  │                  │   RabbitMQ   │
   │ :27017   │                  │ :5672/15672  │
   └──────────┘                  └──────┬───────┘
                                       │
                                       ▼
                            ┌──────────────────┐
                            │ Event Consumer   │
                            │ (Listener)       │
                            └──────────────────┘
```

---

## 💻 Tecnologias

| Componente | Tecnologia | Versão |
|---|---|---|
| **Backend API** | Node.js + Express | 18-alpine |
| **Banco de Dados** | MongoDB | 6.0 |
| **Mensageria** | RabbitMQ | 3.12-management |
| **Gateway** | Node.js + express + http-proxy | 18-alpine |
| **Orquestração** | Docker Compose | 3.8 |
| **ORM** | Mongoose | ^7.5.0 |

---

## 📦 Pré-requisitos

- **Docker**: [Instalar Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Docker Compose**: Geralmente vem com Docker Desktop
- **Git**: Para clonar o repositório (opcional)

Verificar instalação:
```bash
docker --version
docker compose --version
```

---

## 🚀 Como Executar

### 1. Clonar ou Baixar o Projeto

```bash
cd Downloads
git clone <seu-repositorio>
# ou extrair o arquivo .zip
```

### 2. Iniciar toda a aplicação

```bash
docker compose up --build
```

A primeira execução pode levar alguns minutos para baixar as imagens base.

**Saída esperada:**
```
✅ mongodb_1          | ready for connections
✅ rabbitmq_1         | Ready to accept connections
✅ backend1_1         | 🚀 Servidor rodando em http://0.0.0.0:3001
✅ backend2_1         | 🚀 Servidor rodando em http://0.0.0.0:3002
✅ backend3_1         | 🚀 Servidor rodando em http://0.0.0.0:3003
✅ event-consumer_1   | ✅ Event Consumer iniciado
✅ gateway_1          | 🚀 API Gateway rodando em http://0.0.0.0:8080
```

### 3. Acessar a Aplicação

| Serviço | URL | Credenciais |
|---|---|---|
| **API Gateway** | http://localhost:8080 | - |
| **RabbitMQ Management** | http://localhost:15672 | admin / password123 |
| **MongoDB** | mongodb://admin:password123@localhost:27017 | - |

### 4. Parar a Aplicação

```bash
docker compose down
```

Para remover também os volumes de dados:
```bash
docker compose down -v
```

---

## 📡 Endpoints da API

### Health Check

```bash
# Gateway Health
curl http://localhost:8080/health

# Backend Health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
```

### Pilotos

```bash
# Listar pilotos
curl http://localhost:8080/api/pilots

# Criar piloto
curl -X POST http://localhost:8080/api/pilots \
  -H "Content-Type: application/json" \
  -d '{"name":"Fernando Alonso","number":14,"team":"Ferrari"}'

# Atualizar piloto (adicionar pontos após vitória)
curl -X PUT http://localhost:8080/api/pilots/{id} \
  -H "Content-Type: application/json" \
  -d '{"points":25,"wins":1}'

# Deletar piloto
curl -X DELETE http://localhost:8080/api/pilots/{id}
```

### Equipes

```bash
# Listar equipes
curl http://localhost:8080/api/teams

# Buscar equipe por ID
curl http://localhost:8080/api/teams/{id}

# Criar equipe
curl -X POST http://localhost:8080/api/teams \
  -H "Content-Type: application/json" \
  -d '{"name":"Aston Martin","country":"United Kingdom"}'

# Atualizar equipe
curl -X PUT http://localhost:8080/api/teams/{id} \
  -H "Content-Type: application/json" \
  -d '{"points":100}'

# Deletar equipe
curl -X DELETE http://localhost:8080/api/teams/{id}
```

### Corridas

```bash
# Listar corridas
curl http://localhost:8080/api/races

# Criar corrida
curl -X POST http://localhost:8080/api/races \
  -H "Content-Type: application/json" \
  -d '{"name":"Monaco Grand Prix","circuit":"Monte Carlo","date":"2024-05-26"}'

# Finalizar corrida e registrar vencedor
curl -X PUT http://localhost:8080/api/races/{id}/finish \
  -H "Content-Type: application/json" \
  -d '{"winnerId":"<pilot_id>","winnerName":"Max Verstappen"}'
```

### Gateway Metrics

```bash
# Estatísticas do gateway
curl http://localhost:8080/api/gateway/metrics
```

---

## 📊 Opções Implementadas

### ✅ Opção A: API Gateway com Rate Limit e Load Balancer

**Localização:** `gateway/app.js`

#### Features:
- **Rate Limiting**: 20 requisições por janela de 10 segundos
- **Load Balancing**: Algoritmo Round Robin entre 3 instâncias do backend
- **Health Check**: Verifica saúde dos backends a cada 5 segundos
- **Failover Automático**: Se um backend falhar, requisição vai para o próximo
- **Proxy Reverso**: Encaminha requisições com headers customizados
- **Publicação de Eventos**: Envia métricas para RabbitMQ

#### Como testar:

```bash
# 1. Disparar 25 requisições (vai exceder o limite de 20)
for i in {1..25}; do
  curl -s http://localhost:8080/api/pilots | jq '.servedBy' &
done
wait

# 2. Verificar que o Load Balancer distribui entre os 3 backends
for i in {1..6}; do
  curl -s http://localhost:8080/api/pilots | jq '.servedBy'
done

# 3. Ver métricas
curl http://localhost:8080/api/gateway/metrics | jq
```

---

### ✅ Opção B: Sistema de Mensageria com RabbitMQ

**Localização:** `event-consumer/consumer.js`

#### Filas Implementadas:

| Fila | Tipo | Pattern | Propósito |
|---|---|---|---|
| **race-events** | Durable | `race.*` | Eventos de corridas (criação, finalização) |
| **pilot-updates** | Durable | `pilot.*` | Atualizações de pilotos (criar, atualizar, deletar) |
| **gateway-metrics** | Durable | `gateway.*` | Métricas e requisições do gateway |

#### Tipos de Eventos:

1. **Race Events** (`race.*`)
   - `race.created` - Nova corrida criada
   - `race.finished` - Corrida finalizada com vencedor

2. **Pilot Updates** (`pilot.*`)
   - `pilot.created` - Novo piloto registrado
   - `pilot.updated` - Piloto atualizado (pontos, wins)
   - `pilot.deleted` - Piloto removido

3. **Gateway Metrics** (`gateway.*`)
   - `gateway.request` - Métrica de requisição processada

#### Como testar:

```bash
# 1. Criar um piloto (vai publicar evento em `pilot-updates`)
curl -X POST http://localhost:8080/api/pilots \
  -H "Content-Type: application/json" \
  -d '{"name":"Oscar Piastri","number":81,"team":"McLaren"}'

# 2. Ver logs do consumer
docker logs formula1-event-consumer

# 3. Acessar RabbitMQ Management
# URL: http://localhost:15672
# Login: admin / password123
# Ir em "Queues" para ver as filas e mensagens
```

---

## 📁 Estrutura do Projeto

```
formula1-api/
├── docker-compose.yml              # Orquestração de containers
├── README.md                        # Este arquivo
│
├── backend/                         # 🔧 API Backend (3 réplicas)
│   ├── Dockerfile
│   ├── package.json
│   ├── app.js                       # Express server com CRUD
│   └── README.md
│
├── gateway/                         # 🚪 API Gateway (Rate Limit + LB)
│   ├── Dockerfile
│   ├── package.json
│   └── app.js                       # Gateway com rate limiting e load balancer
│
├── event-consumer/                  # 📡 Event Consumer (RabbitMQ)
│   ├── Dockerfile
│   ├── package.json
│   └── consumer.js                  # Listener de eventos
│
├── mongodb/                         # 💾 MongoDB (Banco de dados)
│   ├── Dockerfile
│   └── init-db.js                   # Dados iniciais
│
└── rabbitmq/                        # 🐰 RabbitMQ (Mensageria)
    └── Dockerfile
```

---

## 🏛️ Decisões de Arquitetura

### 1. **Múltiplas Réplicas do Backend (3x)**
- **Por quê**: Demonstrar real necessidade de load balancing
- **Benefício**: Alta disponibilidade, distribuição de carga
- **Como funciona**: Gateway usa Round Robin para distribuir requisições

### 2. **API Gateway Centralizado**
- **Por quê**: Centralizar rate limiting, logging e roteamento
- **Benefício**: Controle único de acesso, métricas agregadas
- **Requisição flui**: Cliente → Gateway → Um dos 3 backends

### 3. **RabbitMQ para Eventos**
- **Por quê**: Desaclopar componentes, permitir processamento assíncrono
- **Benefício**: Escalabilidade, confiabilidade de entrega (persistent)
- **Fluxo**: Backend publica → Consumer processa → MongoDB registra (auditoria)

### 4. **MongoDB como Banco Principal**
- **Por quê**: Schema flexível, replicação nativa, bom para modelo relacional leve
- **Benefício**: Fácil scaling horizontal, suporta dados aninhados (pilotos/equipes)

### 5. **Docker Compose para Orquestração**
- **Por quê**: Simples, nenhuma dependência externa (K8s é overkill)
- **Benefício**: Um comando para subir tudo, fácil para demos e testes locais

### 6. **Health Checks Integrados**
- **Por quê**: Detectar falhas rapidamente
- **Como funciona**: Gateway verifica `/health` dos backends a cada 5s
- **Benefício**: Failover automático, removem-se backends indisponíveis da rotação

---

## 🧪 Testes Manuais Recomendados

### Teste 1: Verificar Load Balancing

```bash
# Executar várias vezes e observar "servedBy" mudando
for i in {1..9}; do
  echo "Requisição $i:"
  curl -s http://localhost:8080/api/pilots | jq '.servedBy'
done
```

**Esperado**: Alternância entre `backend-1`, `backend-2`, `backend-3`

### Teste 2: Testar Rate Limiting

```bash
# Fazer 25 requisições rapidamente
for i in {1..25}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/pilots
done
```

**Esperado**: Primeiras 20 retornam `200`, próximas 5 retornam `429`

### Teste 3: Verificar Eventos no RabbitMQ

```bash
# Criar piloto (publica evento)
curl -X POST http://localhost:8080/api/pilots \
  -H "Content-Type: application/json" \
  -d '{"name":"Lando Norris","number":4,"team":"McLaren"}'

# Ver logs do consumer
docker logs -f formula1-event-consumer
```

### Teste 4: Falhar um Backend

```bash
# Parar um backend
docker compose stop backend2

# Fazer requisições - devem ser roteadas para os outros 2
for i in {1..6}; do
  curl -s http://localhost:8080/api/pilots | jq '.servedBy'
done

# Reiniciar
docker compose up -d backend2
```

---

## 🔍 Monitoramento

### Logs do Gateway
```bash
docker logs -f formula1-gateway
```

### Logs do Event Consumer
```bash
docker logs -f formula1-event-consumer
```

### Logs do MongoDB
```bash
docker logs -f formula1-db
```

### RabbitMQ Management UI
Acesse http://localhost:15672 com credenciais `admin:password123`

---

## 🐛 Troubleshooting

| Problema | Solução |
|---|---|
| Port já em uso | Mudar porta em `docker-compose.yml` ou fazer `docker compose down` |
| Containers não iniciam | Verificar logs: `docker logs <container_name>` |
| Conexão recusada com MongoDB | Aguardar healthcheck passar (5-10s) |
| RabbitMQ não conecta | Verificar se rabbitmq container está rodando: `docker ps` |
| Gateway retorna 503 | Verificar se backends estão saudáveis: `curl http://localhost:8080/health` |

---

## 📋 Critérios de Avaliação

| Critério | Status | Peso |
|---|---|---|
| API funcional com CRUD | ✅ Implementado | 2 |
| Persistência (MongoDB) | ✅ Implementado | - |
| Opção A (API Gateway) | ✅ Implementado | 2 |
| Opção B (RabbitMQ) | ✅ Implementado | 2 |
| Docker (Dockerfiles + Compose) | ✅ Implementado | 1 |
| Documentação clara | ✅ Este README | 1 |
| **Total** | **✅** | **8** |

---

## 📚 Referências

- [Express.js Documentation](https://expressjs.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [http-proxy Documentation](https://github.com/http-party/node-http-proxy)

---

## 👥 Autores

- Projeto Acadêmico - Arquitetura Distribuída

---

## 📝 Notas Finais

Este projeto é uma **implementação educacional** que visa demonstrar:
- ✅ Padrões de API Gateway
- ✅ Load Balancing e failover
- ✅ Rate Limiting
- ✅ Mensageria assíncrona
- ✅ Containerização com Docker
- ✅ Orquestração com Docker Compose

Para ambiente de produção, considere:
- Usar Kubernetes em vez de Docker Compose
- Implementar autenticação (OAuth2/JWT) no gateway
- Adicionar HTTPS/TLS
- Usar managed services (AWS RDS, AWS SQS, etc.)
- Implementar circuit breaker pattern
- Adicionar observabilidade (Prometheus, Grafana, Jaeger)

---

**Pronto para apresentação!** 🚀
