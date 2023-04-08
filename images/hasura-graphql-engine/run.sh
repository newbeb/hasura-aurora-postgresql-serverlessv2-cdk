#!/bin/sh

echo "Starting up graphql-engine on ${DATABASE_HOSTNAME}:${DATABASE_PORT} as ${DATABASE_USERNAME} on database ${DATABASE_NAME} using supplied credentials"

graphql-engine \
--host $DATABASE_HOSTNAME \
--port $DATABASE_PORT \
--user $DATABASE_USERNAME \
--password $DATABASE_PASSWORD \
--dbname $DATABASE_NAME \
serve
