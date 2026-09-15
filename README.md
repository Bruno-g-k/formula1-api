# Formula 1 API

API RESTful distribuida com API Gateway, balanceamento de carga Round Robin, mensageria com RabbitMQ e persistencia em MongoDB.

---

## 1. URLs de Acesso

| Servico | URL | Credenciais / Porta |
|---|---|---|
| API Gateway | http://localhost:8080 | Porta 8080 |
| RabbitMQ Management | http://localhost:15672 | Usuario: admin \| Senha: password123 |
| MongoDB | mongodb://localhost:27017 | Usuario: admin \| Senha: password123 |
| Backend 1 | http://localhost:3001 | Porta 3001 |
| Backend 2 | http://localhost:3002 | Porta 3002 |
| Backend 3 | http://localhost:3003 | Porta 3003 |

### Endpoints Principais (via Gateway)

- GET http://localhost:8080/health
- GET http://localhost:8080/api/gateway/metrics
- GET / POST http://localhost:8080/api/pilots
- GET / PUT / DELETE http://localhost:8080/api/pilots/:id
- GET / POST http://localhost:8080/api/teams
- GET / PUT / DELETE http://localhost:8080/api/teams/:id
- GET / POST http://localhost:8080/api/races
- PUT http://localhost:8080/api/races/:id/finish

---

## 2. Comandos para Subir e Parar

### Subir a aplicacao

Git Bash:
```bash
docker compose up --build -d
```

PowerShell:
```powershell
docker compose up --build -d
```

### Ver status dos containers

Git Bash:
```bash
docker compose ps
```

PowerShell:
```powershell
docker compose ps
```

### Ver logs em tempo real

Git Bash:
```bash
docker compose logs -f
```

PowerShell:
```powershell
docker compose logs -f
```

### Parar a aplicacao

Git Bash:
```bash
docker compose down
```

PowerShell:
```powershell
docker compose down
```

### Parar e resetar volumes do banco de dados

Git Bash:
```bash
docker compose down -v
```

PowerShell:
```powershell
docker compose down -v
```

---

## 3. Comandos para Demonstrar

### A. Health Check e Metricas do Gateway

#### Verificar saude do Gateway e backends

Git Bash:
```bash
curl http://localhost:8080/health
```

PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/health"
```

#### Consultar metricas do Gateway

Git Bash:
```bash
curl http://localhost:8080/api/gateway/metrics
```

PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/gateway/metrics"
```

---

### B. CRUD e Persistencia

#### Listar pilotos

Git Bash:
```bash
curl http://localhost:8080/api/pilots
```

PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/pilots"
```

#### Criar piloto

Git Bash:
```bash
curl -X POST http://localhost:8080/api/pilots \
  -H "Content-Type: application/json" \
  -d '{"name":"Ayrton Senna","number":12,"team":"McLaren"}'
```

PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/pilots" -Method Post -ContentType "application/json" -Body '{"name":"Ayrton Senna","number":14,"team":"McLaren"}'
```

#### Atualizar piloto

Git Bash:
```bash
curl -X PUT http://localhost:8080/api/pilots/6aa9d14b2aeffec0179df8a7 \
  -H "Content-Type: application/json" \
  -d '{"number":2}'
```

PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/pilots/6aa9d14b2aeffec0179df8a7" -Method Put -ContentType "application/json" -Body '{"number":2}'
```

#### Remover piloto

Git Bash:
```bash
curl -X DELETE http://localhost:8080/api/pilots/6aa9d14b2aeffec0179df8a7
```

PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/pilots/6aa9d14b2aeffec0179df8a7" -Method Delete
```

#### Listar equipes

Git Bash:
```bash
curl http://localhost:8080/api/teams
```

PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/teams"
```

#### Criar equipe

Git Bash:
```bash
curl -X POST http://localhost:8080/api/teams \
  -H "Content-Type: application/json" \
  -d '{"name":"Williams","country":"United Kingdom"}'
```

PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/teams" -Method Post -ContentType "application/json" -Body '{"name":"Williams","country":"United Kingdom"}'
```

#### Atualizar equipe

Git Bash:
```bash
curl -X PUT http://localhost:8080/api/teams/6aa9d70cd0083e3d9740eaf7 \
  -H "Content-Type: application/json" \
  -d '{"points":20}'
```

PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/teams/6aa9d70cd0083e3d9740eaf7" -Method Put -ContentType "application/json" -Body '{"points":10}'
```

#### Remover equipe

Git Bash:
```bash
curl -X DELETE http://localhost:8080/api/teams/6aa9d70cd0083e3d9740eaf7
```

PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/teams/6aa9d70cd0083e3d9740eaf7" -Method Delete
```

#### Listar corridas

Git Bash:
```bash
curl http://localhost:8080/api/races
```

PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/races"
```

#### Criar corrida

Git Bash:
```bash
curl -X POST http://localhost:8080/api/races \
  -H "Content-Type: application/json" \
  -d '{"name":"Interlagos GP","circuit":"Interlagos","date":"2024-11-03"}'
```

PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/races" -Method Post -ContentType "application/json" -Body '{"name":"Interlagos GP","circuit":"Interlagos","date":"2024-11-03"}'
```

---

### C. Demonstrar Load Balancer (Round Robin)

Realiza 9 requisicoes consecutivas demonstrando a alternancia entre `backend-1`, `backend-2` e `backend-3`.

Git Bash:
```bash
for i in {1..9}; do
  curl -s http://localhost:8080/api/pilots | grep -o '"servedBy":"[^"]*"'
done
```

PowerShell:
```powershell
1..9 | ForEach-Object {
  $res = Invoke-RestMethod -Uri "http://localhost:8080/api/pilots"
  Write-Host "Requisicao $_ -> Atendido por: $($res.servedBy)"
}
```

---

### D. Demonstrar Rate Limiting

O Gateway limita em 20 requisicoes a cada 10 segundos por IP. Em uma rajada de 25 requisicoes, as 20 primeiras retornam status 200 e as 5 seguintes retornam status 429.

Git Bash:
```bash
for i in {1..25}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/pilots
done
```

PowerShell:
```powershell
1..25 | ForEach-Object {
  try {
    $res = Invoke-WebRequest -Uri "http://localhost:8080/api/pilots" -UseBasicParsing
    Write-Host "$_ : $($res.StatusCode)"
  } catch {
    Write-Host "$_ : $($_.Exception.Response.StatusCode.value__)"
  }
}
```

---

### E. Demonstrar Mensageria e Event Consumer (RabbitMQ)

#### Terminal 1: Acompanhar o consumidor de eventos

Git Bash:
```bash
docker logs -f formula1-event-consumer
```

PowerShell:
```powershell
docker logs -f formula1-event-consumer
```

#### Terminal 2: Publicar novo evento ao cadastrar piloto

Git Bash:
```bash
curl -X POST http://localhost:8080/api/pilots \
  -H "Content-Type: application/json" \
  -d '{"name":"Gabriel Bortoleto","number":5,"team":"Sauber"}'
```

PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/pilots" -Method Post -ContentType "application/json" -Body '{"name":"Gabriel Bortoleto","number":5,"team":"Sauber"}'
```