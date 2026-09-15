require('dotenv').config();
const amqp = require('amqplib');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Consumer conectado ao MongoDB'))
  .catch(err => console.error('Erro MongoDB:', err));

const eventLogSchema = new mongoose.Schema({
  eventType: String,
  routingKey: String,
  data: mongoose.Schema.Types.Mixed,
  processedAt: { type: Date, default: Date.now },
  consumer: String
});

const EventLog = mongoose.model('EventLog', eventLogSchema);

async function startConsumer() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URI);
    const channel = await connection.createChannel();
    
    console.log('Consumer conectado ao RabbitMQ');
    
    const raceEventQueue = 'race-events';
    await channel.assertQueue(raceEventQueue, { durable: true });
    await channel.bindQueue(raceEventQueue, 'f1-events', 'race.*');
    
    const pilotUpdateQueue = 'pilot-updates';
    await channel.assertQueue(pilotUpdateQueue, { durable: true });
    await channel.bindQueue(pilotUpdateQueue, 'f1-events', 'pilot.*');
    
    const gatewayMetricsQueue = 'gateway-metrics';
    await channel.assertQueue(gatewayMetricsQueue, { durable: true });
    await channel.bindQueue(gatewayMetricsQueue, 'f1-events', 'gateway.*');
    
    console.log(`Filas criadas:`);
    console.log(`   - ${raceEventQueue}`);
    console.log(`   - ${pilotUpdateQueue}`);
    console.log(`   - ${gatewayMetricsQueue}`);
    
    channel.consume(raceEventQueue, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          
          console.log(`\n[RACE EVENT] ${content.eventType || 'Evento de Corrida'}`);
          console.log(`   Dados:`, JSON.stringify(content, null, 2));
          
          if (msg.fields.routingKey === 'race.created') {
            console.log(`   -> Preparando para corrida: ${content.name} em ${content.circuit}`);
          } else if (msg.fields.routingKey === 'race.finished') {
            console.log(`   -> Vencedor: ${content.winner}`);
          }
          
          await EventLog.create({
            eventType: 'RACE_EVENT',
            routingKey: msg.fields.routingKey,
            data: content,
            consumer: 'race-consumer'
          });
          
          channel.ack(msg);
        } catch (error) {
          console.error('Erro ao processar evento de corrida:', error);
          channel.nack(msg, false, true);
        }
      }
    }, { noAck: false });
    
    channel.consume(pilotUpdateQueue, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          
          console.log(`\n[PILOT UPDATE] ${content.eventType || 'Atualizacao de Piloto'}`);
          console.log(`   Piloto: ${content.name}`);
          console.log(`   Dados:`, JSON.stringify(content, null, 2));
          
          if (msg.fields.routingKey === 'pilot.created') {
            console.log(`   -> Novo piloto registrado: #${content.number}`);
          } else if (msg.fields.routingKey === 'pilot.updated') {
            console.log(`   -> Pontos atualizados para ${content.points}`);
          } else if (msg.fields.routingKey === 'pilot.deleted') {
            console.log(`   -> Piloto removido do campeonato`);
          }
          
          await EventLog.create({
            eventType: 'PILOT_UPDATE',
            routingKey: msg.fields.routingKey,
            data: content,
            consumer: 'pilot-consumer'
          });
          
          channel.ack(msg);
        } catch (error) {
          console.error('Erro ao processar atualizacao de piloto:', error);
          channel.nack(msg, false, true);
        }
      }
    }, { noAck: false });
    
    channel.consume(gatewayMetricsQueue, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          
          if (content.statusCode >= 400) {
            console.log(`\n[GATEWAY METRIC] Status ${content.statusCode}`);
            console.log(`   ${content.method} ${content.path}`);
            console.log(`   Backend: ${content.backend}`);
            console.log(`   Tempo: ${content.responseTime}ms`);
          }
          
          await EventLog.create({
            eventType: 'GATEWAY_METRIC',
            routingKey: msg.fields.routingKey,
            data: content,
            consumer: 'gateway-metrics-consumer'
          });
          
          channel.ack(msg);
        } catch (error) {
          console.error('Erro ao processar metrica:', error);
          channel.nack(msg, false, true);
        }
      }
    }, { noAck: false });
    
    console.log(`\nEvent Consumer iniciado e aguardando mensagens...`);
    console.log(`   Filas monitoradas:`);
    console.log(`   - ${raceEventQueue} (race.*)  [Eventos de Corrida]`);
    console.log(`   - ${pilotUpdateQueue} (pilot.*) [Atualizacoes de Pilotos]`);
    console.log(`   - ${gatewayMetricsQueue} (gateway.*) [Metricas do Gateway]`);
    
    process.on('SIGINT', async () => {
      console.log('\nDesligando consumer...');
      await channel.close();
      await connection.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Erro ao iniciar consumer:', error);
    setTimeout(startConsumer, 5000);
  }
}

startConsumer();
