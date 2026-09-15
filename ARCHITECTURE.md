# 🏗️ Decisões de Arquitetura - Fórmula 1 API

## 1. Visão Geral

Este projeto implementa uma arquitetura de **microsserviços com padrões distribuídos** para gerenciar dados de Fórmula 1.

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────┐
│      API Gateway             │  ← Rate Limiting
│  (Node.js + http-proxy)      │  ← Load Balancing
└────┬──────┬──────┬───────────┘
     │      │      │
     ▼      ▼      ▼
┌─────────┬─────────┬─────────┐
│Backend 1│Backend 2│Backend 3│  ← Réplicas
└────┬────┴────┬────┴────┬────┘
     │         │         │
     └─────────┼─────────┘
               │
               ▼
          ┌────────────┐
          │  MongoDB   │  ← Persistência
          └─────┬──────┘
                │
                ▼
          ┌──────────────────┐
          │    RabbitMQ      │  ← Mensageria
          └────────┬─────────┘
                   │
                   ▼
          ┌──────────────────┐
          │ Event Consumer   │  ← Processamento Async
          └──────────────────┘
```

---

## 2. Camada de Apresentação: API Gateway

### Por que usar Gateway?

| Problema | Solução | Benefício |
|---|---|---|
| Sem ponto único de entrada | Gateway centraliza tráfego | Controle de acesso |
| Rate limiting distribuído | Gateway enforça limite global | Proteção contra abuso |
| Clientes sabem de todos os backends | Load Balancer esconde detalhes | Escalabilidade transparente |
| Sem logging centralizado | Gateway registra tudo | Auditoria e debugging |
| Autenticação em cada backend | Gateway autentica uma vez | Eficiência e segurança |

### Implementação

```javascript
// Gateway seleciona backend usando Round Robin
const selectBackend = () => {
  const healthyBackends = UPSTREAMS.filter(url => backendHealth.get(url));
  const selected = healthyBackends[currentBackendIndex % healthyBackends.length];
  currentBackendIndex++;
  return selected;
}

// Rate Limiting verifica por IP
const checkRateLimit = (clientIp) => {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `${clientIp}:${now}`;
  // Incrementa contador, retorna false se excedeu
}
```

### Health Check

```javascript
// A cada 5 segundos, gateway verifica saúde
setInterval(async () => {
  for (const upstream of UPSTREAMS) {
    const response = await fetch(`${upstream}/health`);
    backendHealth.set(upstream, response.ok);
  }
}, 5000);
```

**Benefício**: Failover automático sem configuração manual

---

## 3. Camada de Aplicação: Backend API (3 réplicas)

### Por que 3 réplicas?

| Aspecto | Razão |
|---|---|
| **Alta Disponibilidade** | Se 1 cai, 2 continuam rodando |
| **Escalabilidade** | Aumenta capacidade 3x em relação a 1 instância |
| **Demonstração** | Mostra real benefício do load balancing |
| **Resiliência** | Load balancer pode remover 1 sem perder tráfego |

### Especificação

- **Framework**: Express.js (leve, simples, educational)
- **Porta**: 3001-3003 (uma por réplica)
- **Container**: Dockerfile idêntico (mesmo código)
- **Variáveis de Ambiente**: PORT e INSTANCE_ID diferem por replica

### CRUD Implementado

#### Pilotos
- `GET /api/pilots` - Listar todos
- `POST /api/pilots` - Criar novo
- `PUT /api/pilots/{id}` - Atualizar (simular vitória, adicionar pontos)
- `DELETE /api/pilots/{id}` - Remover

#### Equipes
- `GET /api/teams` - Listar
- `POST /api/teams` - Criar

#### Corridas
- `GET /api/races` - Listar
- `POST /api/races` - Criar
- `PUT /api/races/{id}/finish` - Finalizar com vencedor

### Health Check Local

```javascript
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    instance: INSTANCE_ID,
    timestamp: new Date().toISOString()
  });
});
```

**Chamado pelo**: Gateway a cada 5s

---

## 4. Camada de Persistência: MongoDB

### Por que MongoDB?

| Característica | Benefício |
|---|---|
| **Schema Flexível** | Fácil adicionar campos sem migration |
| **Replicação Nativa** | Dados replicados automaticamente |
| **Escalabilidade Horizontal** | Suporta sharding |
| **Transações ACID** | A partir de 4.0 |
| **Índices** | Queries otimizadas |

### Modelos de Dados

```javascript
// Piloto
{
  _id: ObjectId,
  name: String,           // "Max Verstappen"
  number: Number,         // 1
  team: String,           // "Red Bull Racing"
  points: Number,         // 0-999
  wins: Number,           // 0-N
  createdAt: Date
}

// Equipe
{
  _id: ObjectId,
  name: String,           // "Red Bull Racing"
  country: String,        // "Austria"
  points: Number,
  createdAt: Date
}

// Corrida
{
  _id: ObjectId,
  name: String,           // "Brazil Grand Prix"
  circuit: String,        // "Interlagos"
  date: Date,             // "2024-11-03"
  winner: String,         // Nome do vencedor
  finished: Boolean,      // true/false
  createdAt: Date
}
```

### Dados Iniciais

Arquivo `init-db.js` prepara:
- 4 equipes (Red Bull, Mercedes, McLaren, Ferrari)
- 6 pilotos (2 por equipe)
- 3 corridas (vazias, sem vencedor)

**Executa em**: Startup do Docker (quando MongoDB tiver pronto)

---

## 5. Camada de Mensageria: RabbitMQ

### Por que RabbitMQ?

| Razão | Detalhe |
|---|---|
| **Desacoplamento** | Producer e Consumer não se conhecem |
| **Confiabilidade** | Mensagens persistidas em disco |
| **Escalabilidade** | Múltiplos consumers por fila |
| **Redelivery** | Se consumer falha, mensagem volta à fila |
| **Management UI** | Interface web para monitoramento |

### Filas Implementadas

#### Fila 1: `race-events`
- **Pattern**: `race.*`
- **Tipo**: Durable (sobrevive restart)
- **Proposito**: Eventos de ciclo de vida de corridas
- **Eventos**:
  - `race.created` - Corrida criada
  - `race.finished` - Corrida finalizada

#### Fila 2: `pilot-updates`
- **Pattern**: `pilot.*`
- **Tipo**: Durable
- **Proposito**: Atualizações de pilotos
- **Eventos**:
  - `pilot.created` - Piloto criado
  - `pilot.updated` - Piloto atualizado (pontos, wins)
  - `pilot.deleted` - Piloto removido

#### Fila 3: `gateway-metrics`
- **Pattern**: `gateway.*`
- **Tipo**: Durable
- **Proposito**: Métricas de requisições do gateway
- **Eventos**:
  - `gateway.request` - Requisição processada com timing/backend/status

### Pub/Sub Pattern

```javascript
// No Backend: Publicar evento
channel.publish(
  'f1-events',              // Exchange
  'pilot.created',          // Routing Key
  Buffer.from(JSON.stringify({
    pilotId: pilot._id,
    name: pilot.name,
    timestamp: new Date()
  })),
  { persistent: true }      // Persistir em disco
);

// No Consumer: Escutar eventos
channel.assertQueue('pilot-updates', { durable: true });
channel.bindQueue('pilot-updates', 'f1-events', 'pilot.*');
channel.consume('pilot-updates', handleMessage);
```

---

## 6. Event Consumer - Processamento Assíncrono

### Responsabilidades

1. **Escutar Eventos**: Subscribe nas 3 filas
2. **Processar**: Executar lógica de negócio (atualmente: log + audit)
3. **Persistir**: Armazenar eventos em MongoDB para auditoria
4. **Recuperação**: Implementar retry automático

### Fluxo

```
Backend publica evento
         │
         ▼
RabbitMQ Exchange (f1-events)
         │
    ┌────┴────┬────────┬───────────┐
    │          │        │           │
    ▼          ▼        ▼           ▼
race-events pilot-updates gateway-metrics
    │          │        │           │
    └────┬─────┴────┬───┴───────────┘
         │          │
         ▼          ▼
    Event Consumer (3 listeners paralelos)
         │          │
         ▼          ▼
    Log + Audit   MongoDB (EventLog)
```

### Garantias de Entrega

```javascript
// Manual acknowledgment - garante processamento
channel.consume(queue, async (msg) => {
  try {
    // Processar
    await processEvent(msg);
    channel.ack(msg);        // ✅ Aceitar
  } catch (error) {
    channel.nack(msg, false, true); // ❌ Requeue
  }
}, { noAck: false });       // Não auto-acknowledge
```

---

## 7. Docker & Orquestração

### Por que Docker Compose?

| Critério | Resposta |
|---|---|
| Simplicidade | Um arquivo (`docker-compose.yml`) e um comando |
| Reprodutibilidade | Ambiente idêntico em qualquer máquina |
| Isolamento | Cada serviço em seu próprio container |
| Networking | Containers se comunicam por hostname |
| Volumes | Persistência de dados entre reinicializações |
| Health Checks | Retry automático até services estarem prontos |

### Estrutura de Services

```yaml
services:
  mongodb:           # Banco de dados
  rabbitmq:          # Message broker
  backend1/2/3:      # 3 réplicas da API
  event-consumer:    # Listener de eventos
  gateway:           # Load balancer + Rate limit
```

### Ordem de Inicialização (Automática)

```
1. mongodb inicia
   ↓ (healthcheck: ping)
2. rabbitmq inicia
   ↓ (healthcheck: accept connections)
3. backend1/2/3 iniciam (dependem de mongodb e rabbitmq)
   ↓ (healthcheck: GET /health)
4. event-consumer inicia (depende de rabbitmq)
5. gateway inicia (depende de backend1/2/3)
   ↓ (healthcheck: GET /health)
6. Todo o sistema pronto!
```

### Networking

```
┌─ Docker Network: "formula1-network" ─┐
│                                       │
│ ┌──────┐      ┌──────┐      ┌─────┐ │
│ │mongodb│      │rabbitmq│    │gw  │ │
│ └───┬──┘      └───┬───┘     └─┬───┘ │
│     │             │           │      │
│  backend1 ◄──────┴───────────┤      │
│  backend2 ◄────────────────────     │
│  backend3                           │
│  event-consumer                     │
│                                     │
└─────────────────────────────────────┘
      ↑
      │ Port Forwarding (host)
      │
  Client (localhost:8080)
```

---

## 8. Padrões de Design Utilizados

### 1. **Load Balancer Pattern**
```
Client → Gateway → [Backend 1, Backend 2, Backend 3]
         (Round Robin selection)
```

### 2. **Bulkhead Pattern** (via isolation)
```
Cada backend em seu próprio container
Falha em 1 não afeta os outros 2
```

### 3. **Health Check / Self-Healing**
```
Gateway verifica /health dos backends
Remove do pool se falhar
Readdiona quando recupera
```

### 4. **Pub/Sub Pattern**
```
Backend → RabbitMQ → Consumer
(Desacoplado, assíncrono)
```

### 5. **API Gateway Pattern**
```
Clients não conhecem backends direto
Gateway centraliza autenticação, rate limit, logging
```

### 6. **Event Sourcing Leve**
```
Eventos publicados para auditoria
EventLog armazena histórico
```

---

## 9. Fluxo de Requisição Completo

### Exemplo: Criar Piloto

```
1. Cliente faz POST para http://localhost:8080/api/pilots

2. GATEWAY recebe
   - Extrai IP cliente
   - Verifica rate limit
   - Seleciona backend via Round Robin → backend2
   - Faz proxy para http://backend2:3001/api/pilots

3. BACKEND-2 recebe
   - Valida dados
   - Insere no MongoDB
   - Publica evento 'pilot.created' no RabbitMQ

4. MONGODB armazena piloto

5. RABBITMQ distribui evento
   - Fila 'pilot-updates' recebe mensagem

6. EVENT CONSUMER processa
   - Lê mensagem da fila
   - Log no console
   - Insere EventLog no MongoDB para auditoria
   - Acknowledge da mensagem

7. GATEWAY retorna resposta ao cliente
   - Copia headers
   - Adiciona X-Served-By: backend2
   - Status 201 Created
```

**Tempo total**: ~100-200ms (varia com latência MongoDB)

---

## 10. Escalabilidade

### Horizontal (mais instâncias)

**Atualmente**: 3 réplicas backend

**Para escalar**: 
```yaml
# Adicionar mais backends no docker-compose.yml
backend4:
  build: ./backend
  environment:
    PORT: 3004
    INSTANCE_ID: backend-4
  # ...

# Atualizar UPSTREAMS no gateway
UPSTREAMS: "http://backend1:3001,http://backend2:3002,http://backend3:3003,http://backend4:3004"
```

Gateway automaticamente distribui requisições para 4 backends

### Vertical (mais recursos)

Gateway detecta automaticamente backends indisponíveis via health check

---

## 11. Observabilidade

### Logging

- **Gateway**: Cada requisição com timing e backend usado
- **Backend**: Operações de banco de dados
- **Consumer**: Eventos processados
- **Docker Compose**: `docker logs -f <service>`

### Métricas Publicadas

Cada requisição gera métrica em RabbitMQ:
```json
{
  "method": "GET",
  "path": "/api/pilots",
  "statusCode": 200,
  "responseTime": 45,  // ms
  "backend": "backend1",
  "timestamp": "2024-01-15T10:30:45Z"
}
```

### Monitoring

- **RabbitMQ Management**: http://localhost:15672
  - Ver mensagens em filas
  - Monitorar consumers
  - Estatísticas de throughput

- **MongoDB Logs**:
  ```bash
  docker logs formula1-db
  ```

---

## 12. Considerações de Produção

### O que mudaria?

| Aspecto | Demo | Produção |
|---|---|---|
| **Autenticação** | Nenhuma | OAuth2/OIDC/JWT no gateway |
| **TLS/HTTPS** | Não | Certificados, HTTPS obrigatório |
| **Load Balancer** | Round Robin | Algoritmo mais sofisticado (least connections) |
| **Rate Limit** | Simples em-memory | Redis distributed |
| **Orquestração** | Docker Compose | Kubernetes |
| **Persistência** | MongoDB local | Managed (AWS DocumentDB, Azure CosmosDB) |
| **Messaging** | RabbitMQ local | Managed (AWS SQS, RabbitMQ Cloud) |
| **Logging** | Console | Centralized (ELK, Loki) |
| **Circuit Breaker** | Health check simples | Sophisticated pattern |
| **Réplicas** | 3 | 10+ (auto-scaling) |

---

## 13. Conclusão

Esta arquitetura demonstra:

✅ **Separação de Responsabilidades**
- Gateway cuida de roteamento/rate limit
- Backends cuidam de lógica de negócio
- Consumer cuidam de processamento assíncrono

✅ **Resiliência**
- Falha de 1 backend não derruba sistema
- Health checks detectam problemas
- Failover automático

✅ **Escalabilidade**
- Adicione mais backends facilmente
- RabbitMQ suporta milhões de mensagens
- MongoDB suporta sharding

✅ **Manutenibilidade**
- Componentes desacoplados
- Fácil substituir/atualizar serviço
- Docker para reprodutibilidade

✅ **Observabilidade**
- Logs de todos os componentes
- Eventos para auditoria
- Métricas publicadas

---

**Este projeto é excelente para fins educacionais e demonstração de arquitetura distribuída!** 🎓
