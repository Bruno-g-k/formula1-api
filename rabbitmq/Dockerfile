FROM rabbitmq:3.12-management

# Habilitar plugin de management (UI)
RUN rabbitmq-plugins enable --offline rabbitmq_management

# Expor portas: AMQP e Management UI
EXPOSE 5672 15672
