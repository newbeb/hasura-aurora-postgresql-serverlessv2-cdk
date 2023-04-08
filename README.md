# Hausra and Aurora Serverless using AWS CDK

This is a project that deploys Hasura along with Aurora Serverless using AWS CDK.

It creates:
* the cluster and the database in the default VPC.
* an ALB over the hasura instance(s)
* a bunch of private VPC endpoints.

It doesn't create a NAT Gateway to reduce overall cost.

See the [images/hasura-graphql-engine/](images/hasura-graphql-engine/) for the Dockerfile and custom run script.

The main stack is in [lib/hasura-cdk-stack.ts](lib/hasura-cdk-stack.ts)

## Inspiration
This implementation takes inspiration from the work of [Gordon Johnson (@elgordino)](https://github.com/elgordino) and his [Lineup Ninja Hasura CDK presentation](https://docs.google.com/presentation/d/10f2EhHGjK8it6oFOKX4ncG7XpHrW7gyw/edit#slide=id.p1).


## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
