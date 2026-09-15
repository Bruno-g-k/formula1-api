require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const amqp = require('amqplib');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3001;
const INSTANCE_ID = process.env.INSTANCE_ID || 'backend-1';

app.use(cors());
app.use(express.json());

let channel;

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log(`[${INSTANCE_ID}] Conectado ao MongoDB`))
  .catch(err => console.error(`[${INSTANCE_ID}] Erro MongoDB:`, err));

async function initRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URI);
    channel = await connection.createChannel();
    
    await channel.assertExchange('f1-events', 'topic', { durable: true });
    await channel.assertQueue('race-events', { durable: true });
    await channel.assertQueue('pilot-updates', { durable: true });
    
    console.log(`[${INSTANCE_ID}] Conectado ao RabbitMQ`);
  } catch (error) {
    console.error(`[${INSTANCE_ID}] Erro RabbitMQ:`, error);
    setTimeout(initRabbitMQ, 5000);
  }
}

async function publishEvent(routingKey, message) {
  if (channel) {
    try {
      channel.publish(
        'f1-events',
        routingKey,
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );
    } catch (error) {
      console.error(`[${INSTANCE_ID}] Erro ao publicar evento:`, error);
    }
  }
}

app.locals.publishEvent = publishEvent;
app.locals.instanceId = INSTANCE_ID;

const pilotSchema = new mongoose.Schema({
  name: { type: String, required: true },
  number: { type: Number, required: true, unique: true },
  team: String,
  points: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  country: String,
  points: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const raceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  circuit: String,
  date: Date,
  winner: String,
  finished: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Pilot = mongoose.model('Pilot', pilotSchema);
const Team = mongoose.model('Team', teamSchema);
const Race = mongoose.model('Race', raceSchema);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    instance: INSTANCE_ID,
    hostname: os.hostname(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/pilots', async (req, res) => {
  try {
    const pilots = await Pilot.find().sort({ number: 1 });
    res.json({
      data: pilots,
      servedBy: INSTANCE_ID,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pilots/:id', async (req, res) => {
  try {
    const pilot = await Pilot.findById(req.params.id);
    if (!pilot) return res.status(404).json({ error: 'Piloto não encontrado' });
    res.json({
      data: pilot,
      servedBy: INSTANCE_ID
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pilots', async (req, res) => {
  try {
    const pilot = new Pilot(req.body);
    await pilot.save();
    
    await publishEvent('pilot.created', {
      pilotId: pilot._id,
      name: pilot.name,
      number: pilot.number,
      timestamp: new Date().toISOString()
    });
    
    res.status(201).json({
      data: pilot,
      servedBy: INSTANCE_ID
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/pilots/:id', async (req, res) => {
  try {
    const pilot = await Pilot.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );
    if (!pilot) return res.status(404).json({ error: 'Piloto não encontrado' });
    
    await publishEvent('pilot.updated', {
      pilotId: pilot._id,
      name: pilot.name,
      points: pilot.points,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      data: pilot,
      servedBy: INSTANCE_ID
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/pilots/:id', async (req, res) => {
  try {
    const pilot = await Pilot.findByIdAndDelete(req.params.id);
    if (!pilot) return res.status(404).json({ error: 'Piloto não encontrado' });
    
    await publishEvent('pilot.deleted', {
      pilotId: pilot._id,
      name: pilot.name,
      timestamp: new Date().toISOString()
    });
    
    res.json({ message: 'Piloto deletado com sucesso', servedBy: INSTANCE_ID });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/teams', async (req, res) => {
  try {
    const teams = await Team.find().sort({ points: -1 });
    res.json({
      data: teams,
      servedBy: INSTANCE_ID
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/teams', async (req, res) => {
  try {
    const team = new Team(req.body);
    await team.save();
    
    await publishEvent('team.created', {
      teamId: team._id,
      name: team.name,
      timestamp: new Date().toISOString()
    });
    
    res.status(201).json({
      data: team,
      servedBy: INSTANCE_ID
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/teams/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Equipe não encontrada' });
    res.json({
      data: team,
      servedBy: INSTANCE_ID
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/teams/:id', async (req, res) => {
  try {
    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );
    if (!team) return res.status(404).json({ error: 'Equipe não encontrada' });
    
    await publishEvent('team.updated', {
      teamId: team._id,
      name: team.name,
      points: team.points,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      data: team,
      servedBy: INSTANCE_ID
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/teams/:id', async (req, res) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) return res.status(404).json({ error: 'Equipe não encontrada' });
    
    await publishEvent('team.deleted', {
      teamId: team._id,
      name: team.name,
      timestamp: new Date().toISOString()
    });
    
    res.json({ message: 'Equipe deletada com sucesso', servedBy: INSTANCE_ID });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/races', async (req, res) => {
  try {
    const races = await Race.find().sort({ date: -1 });
    res.json({
      data: races,
      servedBy: INSTANCE_ID
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/races', async (req, res) => {
  try {
    const race = new Race(req.body);
    await race.save();
    
    await publishEvent('race.created', {
      raceId: race._id,
      name: race.name,
      circuit: race.circuit,
      date: race.date,
      timestamp: new Date().toISOString()
    });
    
    res.status(201).json({
      data: race,
      servedBy: INSTANCE_ID
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/races/:id/finish', async (req, res) => {
  try {
    const { winnerId, winnerName } = req.body;
    
    const race = await Race.findByIdAndUpdate(
      req.params.id,
      { finished: true, winner: winnerName },
      { new: true }
    );
    
    if (!race) return res.status(404).json({ error: 'Corrida não encontrada' });
    
    await Pilot.findByIdAndUpdate(
      winnerId,
      { $inc: { points: 25, wins: 1 } }
    );
    
    await publishEvent('race.finished', {
      raceId: race._id,
      raceName: race.name,
      winner: winnerName,
      winnerId: winnerId,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      data: race,
      servedBy: INSTANCE_ID,
      message: 'Corrida finalizada e pontos atualizados'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

initRabbitMQ();

app.listen(PORT, () => {
  console.log(`[${INSTANCE_ID}] Servidor rodando em http://0.0.0.0:${PORT}`);
  console.log(`[${INSTANCE_ID}] MongoDB: ${process.env.MONGO_URI}`);
  console.log(`[${INSTANCE_ID}] RabbitMQ: ${process.env.RABBITMQ_URI}`);
});
