FROM mongo:6.0

# Copiar script de inicialização
COPY init-db.js /docker-entrypoint-initdb.d/init.js

# Expor porta padrão do MongoDB
EXPOSE 27017
