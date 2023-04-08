import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as rds from 'aws-cdk-lib/aws-rds';

import { Construct } from 'constructs';

export class HasuraCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Just use the default VPC. Customize as necessary
    const vpc = ec2.Vpc.fromLookup(this, 'VPC', {
      isDefault: true
    })

    // Add gateway/interface endpoints so we can access S3, ECR, and Secrets Manager
    const s3VpcGateway = vpc.addGatewayEndpoint('S3GatewayEndpoint', { 
      service: ec2.GatewayVpcEndpointAwsService.S3
    })
    const ecrVpcInterface = vpc.addInterfaceEndpoint('ECRInterfaceEndpoint', { 
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
    })
    const ecrDockerVpcInterface = vpc.addInterfaceEndpoint('ECRDockerInterfaceEndpoint', { 
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
    })
    const smVpcInterface = vpc.addInterfaceEndpoint('SecretsManagerInterfaceEndpoint', { 
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER
    })
    const ssmVpcInterface = vpc.addInterfaceEndpoint('SSMInterfaceEndpoint', { 
      service: ec2.InterfaceVpcEndpointAwsService.SSM
    })
    const cwlVpcInterface = vpc.addInterfaceEndpoint('CloudwatchLogsInterfaceEndpoint', { 
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS
    })


    // allow inbound traffic from anywhere to the db
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc: vpc, // use the vpc created above
      allowAllOutbound: true, // allow outbound traffic to anywhere
    })

    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4("73.219.135.83/32"),
      ec2.Port.tcp(5432),
      'allow inbound traffic from home to the db on port 5432'
    )

    const database = new rds.DatabaseCluster(this, 'DatabaseCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_13_9,
      }),
      instances: 1,
      instanceProps: {
        vpc: vpc,
        instanceType: new ec2.InstanceType('serverless'),
        autoMinorVersionUpgrade: true,
        publiclyAccessible: true,
        securityGroups: [dbSecurityGroup],
        vpcSubnets: vpc.selectSubnets({
          // use the public subnet created above for the db instance since we want to avoid NAT gateways for now
          // In a real production app this is not recommended
          subnetType: ec2.SubnetType.PUBLIC, 
        }),
      },
      port: 5432, // use port 5432 instead of 3306
    })

    // Set our scaling configuration since this isn't yet supported in CDK...
    const dbClusterNode = database.node.defaultChild as rds.CfnDBCluster
    dbClusterNode.addPropertyOverride('ServerlessV2ScalingConfiguration', {
      'MinCapacity': '0.5', 
      'MaxCapacity': '1'
    })

    const hasuraGraphqlEngineImage = new ecr_assets.DockerImageAsset(this, 'HasuraGraphqlEngineImage', {
      directory: 'images/hasura-graphql-engine',
      platform: ecr_assets.Platform.LINUX_ARM64
    })

    const hasuraService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'HasuraService', {
      vpc,
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX
      },
      desiredCount: 1, // TODO: Change to at least 2 to get multi AZ
      publicLoadBalancer: true,
      taskImageOptions: {
        // ecs.ContainerImage.fromRegistry('public.ecr.aws/docker/library/hasura/graphql-engine:latest') // doesn't work due to CMD entry point
        // ecs.ContainerImage.fromRegistry('hasura/graphql-engine:latest')
        // We use a custom image to avoid DockerHub rate limiting issues and to have a cleaner entry point
        image: ecs.ContainerImage.fromDockerImageAsset(hasuraGraphqlEngineImage),
        containerPort: 8080,
        enableLogging: true,
        environment: {
          HASURA_GRAPHQL_ENABLE_CONSOLE: 'true',
          HASURA_LOG_LEVEL: 'debug',
          HASURA_GRAPHQL_PG_CONNECTIONS: '100',
          DATABASE_NAME: 'postgres',
          HASURA_GRAPHQL_ADMIN_SECRET: 'helloworld42' // TODO: Change this to an actual secret
        },
        secrets: {
          //HASURA_GRAPHQL_DATABASE_URL: ecs.Secret.fromSsmParameter(connectionStringParam),
          DATABASE_HOSTNAME: ecs.Secret.fromSecretsManager(database.secret!, 'host'),
          DATABASE_PORT: ecs.Secret.fromSecretsManager(database.secret!, 'port'),
          DATABASE_USERNAME: ecs.Secret.fromSecretsManager(database.secret!, 'username'),
          DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(database.secret!, 'password'),
          // HASURA_GRAPHQL_ADMIN_SECRET: ecs.Secret.fromSsmParameter(),
          // HASURA_JWT_SECRET: ecs.Secret.fromSsmParameter(),
        }
      },
    })
    hasuraService.targetGroup.configureHealthCheck({ enabled: true, path: '/healthz', healthyHttpCodes: '200' })

    database.connections.allowFrom(
      hasuraService.service, 
      new ec2.Port({
        protocol: ec2.Protocol.TCP,
        stringRepresentation: 'postgres fargate connection',
        fromPort: 5432,
        toPort: 5432,
      })
    )
  }
}
