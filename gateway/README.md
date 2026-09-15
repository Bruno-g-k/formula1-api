# 🚪 API Gateway - Fórmula 1

## Descrição
API Gateway que implementa:
- **Rate Limiting**: Limite de requisições por janela de tempo
- **Load Balancing**: Distribuição entre múltiplos backends (Round Robin)
- **Health Check**: Monitoramento automático da saúde dos backends
- **Reverse Proxy**: Encaminhamento de requisições
- **Publicação de Eventos**: Integração com RabbitMQ para métricas

## Porta
`:8080`

## Endpoints

### Health Check
```
GET /health
```
Retorna status do gateway e dos backends

### Gateway Metrics
```
GET /api/gateway/metrics
```
Retorna configuração e estatísticas de operação

### Proxy de API
```
GET/POST/PUT/DELETE /api/*
```
Todas as requisições `GET`, `POST`, `PUT`, `DELETE` para `/api/*` são roteadas para um backend

## Rate Limiting

- **Limite**: 20 requisições por janela
- **Janela**: 10 segundos
- **Por**: IP do cliente

Quando excedido, retorna `HTTP 429 Too Many Requests`

## Load Balancing

### Algoritmo: Round Robin
- Backend 1 → Backend 2 → Backend 3 → Backend 1 → ...

### Health Check
- **Intervalo**: A cada 5 segundos
- **Endpoint**: `/health` de cada backend
- **Falha**: Backend é removido da rotação até recuperar

### Failover Automático
Se um backend configurado cair:
1. Gateway detecta na próxima requisição
2. Remove da rotação automática
3. Próximas requisições vão para backends saudáveis
4. Quando backend recupera, volta à rotação

## Arquitetura Interna

```
Request → Rate Limit Check → Select Backend (LB) → Proxy → Backend
           ↓
           429 (if exceeded)
```

## Eventos Publicados

O gateway publica métricas no RabbitMQ:

**Exchange**: `f1-events`
**Topic**: `gateway.request`

Conteúdo:
```json
{
  "method": "GET",
  "path": "/api/pilots",
  "statusCode": 200,
  "responseTime": 45,
  "backend": "http://backend1:3001",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

## Testes

```bash
# Health
curl http://localhost:8080/health

# Métricas
curl http://localhost:8080/api/gateway/metrics

# Fazer requisições e observar servedBy mudando
for i in {1..6}; do curl -s http://localhost:8080/api/pilots | jq '.servedBy'; done

# Rate Limit (25 requisições)
for i in {1..25}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/pilots; done
```
