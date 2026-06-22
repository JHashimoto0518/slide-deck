import { Duration, Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class CdkEc2Stack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // vpc
    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: 'vpc',
      ipAddresses: ec2.IpAddresses.cidr('172.16.0.0/16'),
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        }
      ],
      restrictDefaultSecurityGroup: false,
    });

    // security group
    const ec2SgWeb = new ec2.SecurityGroup(this, 'Ec2-Web-Sg', {
      vpc,
      allowAllOutbound: true,
      description: 'security group for ec2 web'
    })
    ec2SgWeb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'allow http traffic from anywhere')
    ec2SgWeb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'allow https traffic from anywhere')
    
    const ec2SgBastion = new ec2.SecurityGroup(this, 'Ec2-Bastion-Sg', {
      vpc,
      allowAllOutbound: true,
      description: 'security group for ec2 bastion'
    })
    ec2SgBastion.addIngressRule(ec2.Peer.ipv4('203.0.113.0/24'), ec2.Port.tcp(22), 'allow ssh traffic from example IP address')

    // ec2
    const ec2InsWeb = new ec2.Instance(this, 'Ec2-Web', {
      instanceName: 'ec2-web',
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }),
      securityGroup: ec2SgWeb,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(8, {
            encrypted: true
          }),
        },
      ],
    })

    const ec2InsBastion = new ec2.Instance(this, 'Ec2-Bastion', {
      instanceName: 'ec2-bastion',
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }),
      securityGroup: ec2SgBastion,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(8, {
            encrypted: true
          }),
        },
      ],
    })
  }
}
