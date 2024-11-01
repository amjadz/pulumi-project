import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as aws from "@pulumi/aws";

const cluster = new aws.ecs.Cluster("cluster", {});

const main = new aws.ec2.Vpc("main", {
  cidrBlock: "172.31.0.0/16",
  enableDnsHostnames: true,
});

const mainSubnet = new aws.ec2.Subnet("mainSubnet", {
  vpcId: main.id,
  cidrBlock: "172.31.32.0/20",
});

const mainGateway = new aws.ec2.InternetGateway("mainGateway", {
  vpcId: main.id,
});

const mainRouteTable = new aws.ec2.RouteTable("mainRouteTable", {
  vpcId: main.id,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      gatewayId: mainGateway.id,
    },
  ],
});

const mainRouteTableAssociation = new aws.ec2.MainRouteTableAssociation(
  "mainRouteTableAssociation",
  {
    vpcId: main.id,
    routeTableId: mainRouteTable.id,
  }
);

const mainSecurityGroup = new aws.ec2.SecurityGroup("mainSecurityGroup", {
  vpcId: main.id,
  description: "Enables HTTP accesss",
  ingress: [
    {
      protocol: "TCP",
      fromPort: 8080,
      toPort: 8080,
      cidrBlocks: ["0.0.0.0/0"],
    },
  ],

  egress: [
    {
      protocol: "-1",
      fromPort: 0,
      toPort: 0,
      cidrBlocks: ["0.0.0.0/0"],
    },
  ],
});

const mainExecRole = new aws.iam.Role("mainExecRole", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Principal: {
          Service: "ecs-tasks.amazonaws.com",
        },
        Effect: "Allow",
        Sid: "",
      },
    ],
  }),
});

const maintPolicyAttachment = new aws.iam.RolePolicyAttachment(
  "execPolicyAttachment",
  {
    role: mainExecRole.name,
    policyArn:
      "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
  }
);

const mainTaskRole = new aws.iam.Role("mainTaskRole", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Principal: {
          Service: "ecs-tasks.amazonaws.com",
        },
        Effect: "Allow",
        Sid: "",
      },
    ],
  }),
});

const mainTaskPolicyAttachment = new aws.iam.RolePolicyAttachment(
  "mainTaskPolicyAttachment",
  {
    role: mainTaskRole.name,
    policyArn: aws.iam.ManagedPolicy.AmazonECSFullAccess,
  }
);

const nodeAppTargetGroup = new aws.lb.TargetGroup("nodeAppTargetGroup", {
  vpcId: main.id,
  protocol: "TCP",
  targetType: "ip",
  port: 8080,
});

const nodeAppBalencer = new aws.lb.LoadBalancer("nodeAppBalencer", {
  loadBalancerType: "network",
  internal: false,
  securityGroups: [],
  subnets: [mainSubnet.id],
});

const nodeAppListener = new aws.lb.Listener("nodeAppListener", {
  loadBalancerArn: nodeAppBalencer.arn,
  port: 8080,
  protocol: "TCP",
  defaultActions: [
    {
      type: "forward",
      targetGroupArn: nodeAppTargetGroup.arn,
    },
  ],
});

const repo = new aws.ecr.Repository("pulumi-example");

const imageName = repo.repositoryUrl.apply((url) => url.slice(0, 255));
const customImage = "pulumi-example-img";
const imageVersion = "v1.0.0";

const image = new docker.Image(customImage, {
  build: {
    context: ".",
    dockerfile: "./app/Dockerfile",
  },
  imageName: pulumi.interpolate`${imageName}:${imageVersion}`,
});

const nodeAppTaskDefinition = new aws.ecs.TaskDefinition(
  "nodeAppTaskDefinition",
  {
    family: "frontend-task-definition-family",
    cpu: "256",
    memory: "512",
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    executionRoleArn: mainExecRole.arn,
    taskRoleArn: mainTaskRole.arn,
    runtimePlatform: {
      operatingSystemFamily: "LINUX",
      cpuArchitecture: "ARM64",
    },
    containerDefinitions: imageName.apply((url) =>
      JSON.stringify([
        {
          name: "nodeContainer",
          image: `${url}:v1.0.0`,
          memory: 512,
          essential: true,
          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-create-group": "true",
              "awslogs-group": "ECSLogs",
              "awslogs-region": "us-east-2",
              "awslogs-stream-prefix": "ecs",
            },
          },
          portMappings: [
            {
              containerPort: 8080,
              hostPort: 8080,
              protocol: "TCP",
            },
          ],
        },
      ])
    ),
  }
);

const nodeAppService = new aws.ecs.Service(
  "nodeAppService",
  {
    cluster: cluster.arn,
    desiredCount: 1,
    launchType: "FARGATE",
    taskDefinition: nodeAppTaskDefinition.arn,
    waitForSteadyState: false,
    networkConfiguration: {
      assignPublicIp: true,
      subnets: [mainSubnet.id],
      securityGroups: [mainSecurityGroup.id],
    },

    loadBalancers: [
      {
        containerName: "nodeContainer",
        targetGroupArn: nodeAppTargetGroup.arn,
        containerPort: 8080,
      },
    ],
  },
  {
    dependsOn: nodeAppListener,
  }
);

export const appurl = nodeAppBalencer.dnsName;
