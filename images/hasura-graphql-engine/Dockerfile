# The images for reference are from https://github.com/hasura/graphql-engine/tree/master/packaging
# https://hub.docker.com/r/hasura/graphql-engine-base/tags
FROM hasura/graphql-engine:v2.22.0

COPY run.sh /bin/run.sh
RUN chmod +x /bin/run.sh

CMD run.sh
