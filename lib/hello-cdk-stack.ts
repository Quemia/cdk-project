import * as cdk from 'aws-cdk-lib';
import {
    aws_codecommit as codecommit,
    aws_codepipeline as codepipeline,
    aws_codepipeline_actions as codepipeline_actions,
    aws_elasticbeanstalk as elasticbeanstalk,
    aws_s3 as s3t,
    aws_iam as iam,
    aws_codebuild as codebuild,
    aws_lambda as lambda, aws_lambda_destinations
} from 'aws-cdk-lib';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import {Construct} from "constructs";


export class HelloCdkStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Criação do repositório CodeCommit
        const codeCommitRepository = new codecommit.Repository(this, 'RepositoryCodeCommit', {
            repositoryName: 'my-app-tomcat',
            description: 'my app made with tomcat'
        });


        const buildApplication = new codebuild.Project(this, 'BuildProject', {
            source: codebuild.Source.codeCommit({
                identifier: 'RepositoryCodeCommit',
                repository: codeCommitRepository,
            }),
        })

        const lambdaFunction = new lambda.Function(this, 'MyLambda', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'hello.handler',
            code: lambda.Code.fromAsset('lambda/')
        });

        // Bucket S3
        const codeBucket = new s3t.Bucket(this, 'KekeB', {
            versioned: true
        });


        const appBucketVersion = new s3deploy.BucketDeployment(this, 'AppDeployment', {
            sources: [s3deploy.Source.asset('./assets')],
            destinationBucket: codeBucket,
            destinationKeyPrefix: 'code/',
        });


        const elasticApplication = new elasticbeanstalk.CfnApplication(this, 'ElasticAplication', {
            applicationName: 'MyApp'
        });

        // Versão do  Elastic Beanstalk
        const appVersion = new elasticbeanstalk.CfnApplicationVersion(this, 'AppVersion', {
            applicationName: elasticApplication.applicationName!,
            sourceBundle: {
                s3Bucket: codeBucket.bucketName,
                s3Key: 'code/code.zip'
            }
        });

        appVersion.node.addDependency(appBucketVersion);

        // Perfil de instância IAM para o Elastic Beanstalk

        const existingRoleArn = 'arn:aws:iam::471112743502:role/service-role/aws-elasticbeanstalk-service-role';
        const role = iam.Role.fromRoleArn(this, 'ExistingRole', existingRoleArn)

        const instanceProfile = new iam.CfnInstanceProfile(this, 'InstanceProfile', {
            roles: [role.roleName],
            instanceProfileName: 'aws-elasticbeanstalk-ec2-role',
        });

        // Ambiente Elastic Beanstalk
        const elasticBeanstalkEnvironment = new elasticbeanstalk.CfnEnvironment(this, 'TomcatEnvironment', {
            environmentName: 'TomcatEnvironment',
            applicationName: elasticApplication.applicationName!,
            solutionStackName: '64bit Amazon Linux 2023 v5.3.0 running Tomcat 9 Corretto 17',
            optionSettings: [{
                namespace: 'aws:autoscaling:launchconfiguration',
                optionName: 'InstanceType',
                value: 't3.micro',
            }, {
                namespace: 'aws:autoscaling:launchconfiguration',
                optionName: 'IamInstanceProfile',
                value: instanceProfile.ref,
            }, {
                namespace: 'aws:elasticbeanstalk:environment',
                optionName: 'EnvironmentType',
                value: 'SingleInstance'
            }],
            versionLabel: appVersion.ref,
        });


        elasticBeanstalkEnvironment.addDependency(appVersion);
        elasticBeanstalkEnvironment.addDependency(instanceProfile);

        // Artefatos do CodePipeline

        const s3Artifact = new codepipeline.Artifact('S3Artifact');
        const codeCommitArtifact = new codepipeline.Artifact('CodeCommitArtifact');
        const codeBuildArtifact = new codepipeline.Artifact('CodeBuildArtifact');


        // Pipeline CodePipeline
        const pyPipeline = new codepipeline.Pipeline(this, 'Pipeline', {
            pipelineName: 'py-pipe',
            crossAccountKeys: false,
        });

        const sourceS3Stage = pyPipeline.addStage({
            stageName: 'Source',
            actions: [
                new codepipeline_actions.CodeCommitSourceAction({
                    actionName: 'CodeCommitSource',
                    repository: codeCommitRepository,
                    output: codeCommitArtifact
                }),
            ],
        });

        const buildStage = pyPipeline.addStage({
            stageName: 'Build',
            actions: [
                new codepipeline_actions.CodeBuildAction({
                    actionName: 'CodeCommitSource',
                    input: codeCommitArtifact,
                    project: buildApplication,
                    outputs: [codeBuildArtifact],
                }),
            ],
        });

        const DeployStage = pyPipeline.addStage({
            stageName: 'Deploy',
            actions: [
                new codepipeline_actions.S3DeployAction({
                    actionName: 'S3Deploy',
                    input: codeBuildArtifact,
                    extract: true,
                    bucket: codeBucket
                }),


                // new codepipeline_actions.ElasticBeanstalkDeployAction({
                //     actionName: 'ElasticBeanstalkDeploy',
                //     applicationName: elasticApplication.applicationName!,
                //     environmentName: elasticBeanstalkEnvironment.environmentName!,
                //     input: codeBuildArtifact
                // })

            ]
        });
    }
}
