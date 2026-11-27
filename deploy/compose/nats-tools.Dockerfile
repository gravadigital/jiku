# nats-box (nsc + the nats client) with bash and python3, to run the scripts of deploy/nats/ inside the
# root docker-compose.yml: the NATS identity (bootstrap.sh) and the JetStream setup.
FROM natsio/nats-box:0.18.0
RUN apk add --no-cache bash python3
