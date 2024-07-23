import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import {
  aws_codebuild as codebuild,
  aws_codecommit as codecommit,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipeline_actions, aws_elasticbeanstalk,
  aws_elasticbeanstalk as elasticbeanstalk,
  aws_s3 as s3t, aws_s3_deployment
} from 'aws-cdk-lib';
import * as s3 from '@aws-cdk/aws-s3';
import {Construct} from "constructs";


export class HelloCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Criação do repositório CodeCommit
    const codeCommitRepository = new codecommit.Repository(this, 'RepositoryCodeCommit', {
      repositoryName: 'myAppPy',
      description: 'my app made with python'
    });


    const codeBuildProject = new codebuild.Project(this, 'CodeCommitRepoBuild', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version:'0.2',
        phases:{
          build:{
            commands:['zip -r code.zip .',]
          }
        },
        artifacts: {
          'files':[
              'code.zip'
          ],
        }
      })
    });


    // Bucket S3 para o pacote do aplicativo elastic
    // const appSource = ;
    // const fileName = 'code.zip';

    // Bucket S3
    const codeBucket = new s3t.Bucket(this, 'KekeB', {
      versioned: true
    });


    const appBucketVersion = new s3deploy.BucketDeployment(this, 'AppDeployment', {
      sources: [s3deploy.Source.asset('./assets')],
      destinationBucket: codeBucket,
      destinationKeyPrefix: 'code/',
    });


    const elasticApplication = new elasticbeanstalk.CfnApplication(this,'ElasticAplication',{
      applicationName:'MyApp'
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


    // Ambiente Elastic Beanstalk
    const elasticBeanstalkEnvironment = new elasticbeanstalk.CfnEnvironment(this, 'AppPythonEnvironment', {
      environmentName: 'MyPythonEnvironment',
      applicationName: elasticApplication.applicationName!,
      solutionStackName: '64bit Amazon Linux 2023 v5.2.0 running Tomcat 10 Corretto 17',
      optionSettings: [{
        namespace: 'aws:elasticbeanstalk:environment',
        optionName: 'EnvironmentType',
        value: 'SingleInstance'
      }],
      versionLabel: appVersion.ref, // Substituir pela versão apropriado
    });

    // Artefatos do CodePipeline

    const s3Artifact = new codepipeline.Artifact('S3Artifact');
    const codeCommitArtifact = new codepipeline.Artifact('CodeCommitArtifact');
    const buildOutput = new codepipeline.Artifact('BuildOutput');
    const eBArtifact = new codepipeline.Artifact('EBArtifact');
    // const pipelineBuildArtifact = new codepipeline.Artifact('BuildOutput');


    // Pipeline CodePipeline
    const pyPipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'py-pipe',
      crossAccountKeys: false,
    });

    const sourceS3Stage = pyPipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.S3SourceAction({
          actionName: 'S3Source',
          bucket: codeBucket,
          bucketKey: 'code/code.zip',
          output:  s3Artifact
        }),
        new codepipeline_actions.CodeCommitSourceAction({
          actionName: 'CodeCommitSource',
          repository: codeCommitRepository,
          output: codeCommitArtifact
        }),
      ],
    });

    const BuildStage = pyPipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'BuildFromS3',
          input: s3Artifact,
          project: codeBuildProject,
          outputs: [ new codepipeline.Artifact('S3BuildOutput')],

        }),
        new codepipeline_actions.CodeBuildAction({
          actionName: 'BuildProject',
          input: new codepipeline.Artifact('BuildOutput'),
          project: codeBuildProject,
          outputs: [buildOutput]
        })
      ]
    });

    const DeployStage = pyPipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new codepipeline_actions.ElasticBeanstalkDeployAction({
          actionName:'ElasticBeanstalkDeploy',
          applicationName:elasticApplication.applicationName!,
          environmentName: elasticBeanstalkEnvironment.environmentName!,
          input: buildOutput
        })
      ]
    });
  }
}
