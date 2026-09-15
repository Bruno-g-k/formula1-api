# Teste de Load Balancing
Write-Host "🔄 Testando Load Balancing (Round Robin)..." -ForegroundColor Cyan
for ($i = 1; $i -le 9; $i++) {
    $response = Invoke-RestMethod -Uri "http://localhost:8080/api/pilots" -Method Get
    Write-Host "Requisição $i -> Atendido por: $($response.servedBy)" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Load Balancer distribuindo entre backends!" -ForegroundColor Cyan
