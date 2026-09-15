// Inicialização de dados padrão do MongoDB
db = db.getSiblingDB("formula1");

// Inserir equipes
db.teams.insertMany([
  {
    name: "Red Bull Racing",
    country: "Austria",
    points: 0,
    createdAt: new Date()
  },
  {
    name: "Mercedes",
    country: "Germany",
    points: 0,
    createdAt: new Date()
  },
  {
    name: "McLaren",
    country: "United Kingdom",
    points: 0,
    createdAt: new Date()
  },
  {
    name: "Ferrari",
    country: "Italy",
    points: 0,
    createdAt: new Date()
  }
]);

// Inserir pilotos
db.pilots.insertMany([
  {
    name: "Max Verstappen",
    number: 1,
    team: "Red Bull Racing",
    points: 0,
    wins: 0,
    createdAt: new Date()
  },
  {
    name: "Lewis Hamilton",
    number: 44,
    team: "Mercedes",
    points: 0,
    wins: 0,
    createdAt: new Date()
  },
  {
    name: "Lando Norris",
    number: 4,
    team: "McLaren",
    points: 0,
    wins: 0,
    createdAt: new Date()
  },
  {
    name: "Carlos Sainz",
    number: 55,
    team: "Ferrari",
    points: 0,
    wins: 0,
    createdAt: new Date()
  },
  {
    name: "George Russell",
    number: 63,
    team: "Mercedes",
    points: 0,
    wins: 0,
    createdAt: new Date()
  },
  {
    name: "Charles Leclerc",
    number: 16,
    team: "Ferrari",
    points: 0,
    wins: 0,
    createdAt: new Date()
  }
]);

// Inserir corridas iniciais
db.races.insertMany([
  {
    name: "Bahrain Grand Prix",
    circuit: "Sakhir",
    date: new Date("2024-03-01"),
    finished: false,
    createdAt: new Date()
  },
  {
    name: "Saudi Arabia Grand Prix",
    circuit: "Jeddah",
    date: new Date("2024-03-10"),
    finished: false,
    createdAt: new Date()
  },
  {
    name: "Australian Grand Prix",
    circuit: "Melbourne",
    date: new Date("2024-03-24"),
    finished: false,
    createdAt: new Date()
  }
]);

print("✅ Dados iniciais inseridos com sucesso!");
