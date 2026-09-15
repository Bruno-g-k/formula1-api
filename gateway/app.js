require('dotenv').config();
const express = require('express');
const httpProxy = require('http-proxy');
const cors = require('cors');
const amqp = require('amqplib');

const app = express();
const PORT = process.env.GATEWAY_PORT || 8080;

// Configuração
const RATE_LIMIT_REQUESTS = parseInt(process.env.RATE_LIMIT_REQUESTS) || 20;
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 10;
const UPSTREAMS = (process.env.UPSTREAMS || 'http://backend1:3001').split(',');

// Estado do Load Balancer
let currentBackendIndex = 0;
const backendHealth = new Map(UPSTREAMS.map(url => [url, true]));
let channel;

// Armazenar requisiçõess por IP para rate limit
const rateLimitMap = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Health Check para backends
async function healthCheck() {
  for (const upstream of UPSTREAMS) {
    try {
      const response = await fetch(`${upstream}/health`, { timeout: 3000 });
      backendHealth.set(upstream, response.ok);
    } catch (error) {
      backendHealth.set(upstream, false);
    }
  }
}

// Iniciar verificação de saúde periodicamente
setInterval(healthCheck, 5000);
healthCheck();

// Inicializar RabbitMQ
async function initRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URI);
    channel = await connection.createChannel();
    
    await channel.assertExchange('f1-events', 'topic', { durable: true });
    await channel.assertQueue('gateway-metrics', { durable: true });
    
    console.log('✅ Gateway conectado ao RabbitMQ');
  } catch (error) {
    console.error('❌ Erro RabbitMQ:', error);
    setTimeout(initRabbitMQ, 5000);
  }
}

// Publicar métrica de requisição
async function publishMetric(method, path, statusCode, responseTime, backend) {
  if (channel) {
    try {
      channel.publish(
        'f1-events',
        'gateway.request',
        Buffer.from(JSON.stringify({
          method,
          path,
          statusCode,
          responseTime,
          backend,
          timestamp: new Date().toISOString()
        })),
        { persistent: true }
      );
    } catch (error) {
      console.error('Erro ao publicar métrica:', error);
    }
  }
}

// ========== LOAD BALANCER ==========

// Selecionar backend usando Round Robin
function selectBackend() {
  const healthyBackends = UPSTREAMS.filter(url => backendHealth.get(url));
  
  if (healthyBackends.length === 0) {
    throw new Error('Nenhum backend disponível');
  }
  
  // Round Robin
  const selected = healthyBackends[currentBackendIndex % healthyBackends.length];
  currentBackendIndex++;
  
  return selected;
}

// ========== RATE LIMITING ==========

function checkRateLimit(clientIp) {
  const now = Math.floor(Date.now() / 1000);
  // Agrupar por janela de RATE_LIMIT_WINDOW segundos
  const windowIndex = Math.floor(now / RATE_LIMIT_WINDOW);
  const windowKey = `${clientIp}:${windowIndex}`;
  
  if (!rateLimitMap.has(windowKey)) {
    rateLimitMap.set(windowKey, 0);
  }
  
  const count = rateLimitMap.get(windowKey);
  
  if (count >= RATE_LIMIT_REQUESTS) {
    return false; // Rate limit excedido
  }
  
  rateLimitMap.set(windowKey, count + 1);
  
  // Limpeza de chaves antigas (janelas passadas)
  if (rateLimitMap.size > 10000) {
    const minWindowIndex = windowIndex - 2;
    for (const [key] of rateLimitMap) {
      const [, win] = key.split(':');
      if (parseInt(win) < minWindowIndex) {
        rateLimitMap.delete(key);
      }
    }
  }
  
  return true; // Dentro do limite
}

// Middleware de Rate Limit
app.use((req, res, next) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Limite de ${RATE_LIMIT_REQUESTS} requisições a cada ${RATE_LIMIT_WINDOW}s excedido`,
      retryAfter: RATE_LIMIT_WINDOW
    });
  }
  
  next();
});

// ========== ROTAS ==========

// Health Check do Gateway
app.get('/health', (req, res) => {
  const healthyCount = Array.from(backendHealth.values()).filter(v => v).length;
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    upstreams: {
      total: UPSTREAMS.length,
      healthy: healthyCount,
      backends: Array.from(backendHealth.entries()).map(([url, healthy]) => ({
        url,
        status: healthy ? 'UP' : 'DOWN'
      }))
    }
  });
});

// Rota de Métricas do Gateway
app.get('/api/gateway/metrics', (req, res) => {
  res.json({
    rateLimit: {
      requestsPerWindow: RATE_LIMIT_REQUESTS,
      windowSeconds: RATE_LIMIT_WINDOW,
      activeWindows: rateLimitMap.size
    },
    backends: Array.from(backendHealth.entries()).map(([url, healthy]) => ({
      url,
      status: healthy ? 'UP' : 'DOWN'
    })),
    loadBalancingAlgorithm: 'round-robin',
    totalActiveRequests: Object.keys(req.socket._httpMessage || {}).length
  });
});

// Proxy global (instância única para evitar vazamento de memória)
const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  timeout: 30000,
  proxyTimeout: 30000
});

// Tratar erros do proxy globalmente
proxy.on('error', (error, req, res) => {
  const backend = req.headers['x-served-by'];
  console.error(`[${backend}] Erro no proxy:`, error.message);
  
  // Marcar backend como indisponível
  if (backend) backendHealth.set(backend, false);
  
  if (!res.headersSent) {
    res.status(503).json({
      error: 'Backend unavailable',
      message: 'O servidor backend não está disponível no momento',
      backend
    });
  }
});

// Log da requisição após resposta
proxy.on('proxyRes', (proxyRes, req) => {
  const responseTime = Date.now() - req._startTime;
  const backend = req.headers['x-served-by'];
  console.log(`[GATEWAY] ${req.method} ${req.url} -> ${backend} | Status: ${proxyRes.statusCode} | ${responseTime}ms`);
  
  // Publicar métrica
  publishMetric(req.method, req.url, proxyRes.statusCode, responseTime, backend);
  
  // Adicionar headers de resposta
  proxyRes.headers['x-gateway-time'] = `${responseTime}`;
  proxyRes.headers['x-served-by'] = backend;
});

// Proxy para todas as requisições de API
app.all('/api/*', async (req, res) => {
  try {
    req._startTime = Date.now();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Selecionar backend
    const backend = selectBackend();
    
    // Adicionar headers customizados
    req.headers['x-forwarded-for'] = clientIp;
    req.headers['x-forwarded-proto'] = 'http';
    req.headers['x-served-by'] = backend;
    
    // Fazer proxy da requisição
    proxy.web(req, res, { target: backend });
    
  } catch (error) {
    console.error('[GATEWAY] Erro:', error.message);
    res.status(503).json({
      error: 'Service Unavailable',
      message: error.message
    });
  }
});

// Iniciar servidor
initRabbitMQ();

app.listen(PORT, () => {
  console.log(`\n🚀 API Gateway rodando em http://0.0.0.0:${PORT}`);
  console.log(`📊 Rate Limit: ${RATE_LIMIT_REQUESTS} requisições a cada ${RATE_LIMIT_WINDOW}s`);
  console.log(`⚙️  Algoritmo: Round Robin`);
  console.log(`🔄 Backends:`);
  UPSTREAMS.forEach(url => console.log(`   - ${url}`));
  console.log(`\n📡 Documentação disponível em http://localhost:${PORT}/health\n`);
});
