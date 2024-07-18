import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import {aws_ec2} from "aws-cdk-lib";
import {subnetId} from "aws-cdk-lib/aws-ec2/lib/util";

const instanceName = 'hello-cdk';
const instanceRoleArn = 'arn-role-instance'
const az = 'us-east-2c';
const amiName = 'nome da instancia';
const subnetIds = ['num subnet'];


export class HelloCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ec2 instance
    const instance = new aws_ec2.Instance(this, 'Instance', {
      instanceName,
      instanceType: aws_ec2.InstanceType.of(
          aws_ec2.InstanceClass.T2,
          aws_ec2.InstanceSize.MICRO
      ),
      machineImage: aws_ec2.MachineImage.lookup({
        name: amiName, // Nome da AMI (assumindo que 'amiName' é uma variável previamente definida)
      }),
      vpc, // VPC onde a instância será criada
      role, // função AMI associada a instância
      vpcSubnets:{
        subnets: subnetIds.map((subnetId, i) =>
          aws_ec2.Subnet.fromSubnetAttributes(this, `Subnet${i}`, {
            subnetId,
            availabilityZone: az, // Zona de disponibilidade
          })
        )
      },
      securityGroup, //grupo de segurnaça associado
      blockDevices:[
        {
          deviceName: '/dev/xvda', // Nome do dispositivo para o volume
          volume: aws_ec2.BlockDeviceVolume.ebs(30), // Volume EBS de 30 GB
        },
      ],
      availabilityZone:az, // Zona de disponibilidade
    });



  }
}
