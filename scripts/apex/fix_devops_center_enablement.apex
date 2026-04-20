Id projectId = 'a0Md2000000luJhEAI';
Id pipelineId = 'a0Ld200000C4xyfEAB';
Id stageId = 'a0Kd2000007AB1NEAW';

Map<String, sf_devops__Environment__c> existingByOrgId = new Map<String, sf_devops__Environment__c>();
for (sf_devops__Environment__c env : [
    SELECT Id, Name, sf_devops__Org_Id__c
    FROM sf_devops__Environment__c
    WHERE sf_devops__Project__c = :projectId
]) {
    existingByOrgId.put(env.sf_devops__Org_Id__c, env);
}

sf_devops__Environment__c productionEnv = existingByOrgId.get('00DWU00000l1sbB2AQ');
if (productionEnv == null) {
    productionEnv = new sf_devops__Environment__c(
        Name = 'Production',
        sf_devops__Project__c = projectId,
        sf_devops__Org_Id__c = '00DWU00000l1sbB2AQ',
        sf_devops__Named_Credential__c = 'Production_1PJd20000004WkTGAU_1776244895509',
        sf_devops__Can_Track_Changes__c = false,
        sf_devops__Test_Environment__c = false,
        sf_devops__Expired__c = false
    );
    insert productionEnv;
}

sf_devops__Environment__c devEnv = existingByOrgId.get('00DQJ00000G0QcP2AV');
if (devEnv == null) {
    devEnv = new sf_devops__Environment__c(
        Name = 'Dev',
        sf_devops__Project__c = projectId,
        sf_devops__Org_Id__c = '00DQJ00000G0QcP2AV',
        sf_devops__Named_Credential__c = 'Dev_1PJd20000004WkTGAU_1776244935056',
        sf_devops__Can_Track_Changes__c = true,
        sf_devops__Test_Environment__c = true,
        sf_devops__Expired__c = false
    );
    insert devEnv;
}

sf_devops__Pipeline_Stage__c stage = [
    SELECT Id, sf_devops__Environment__c
    FROM sf_devops__Pipeline_Stage__c
    WHERE Id = :stageId
    LIMIT 1
];
stage.sf_devops__Environment__c = productionEnv.Id;
update stage;

sf_devops__Pipeline__c pipeline = [
    SELECT Id, sf_devops__Activated__c
    FROM sf_devops__Pipeline__c
    WHERE Id = :pipelineId
    LIMIT 1
];
pipeline.sf_devops__Activated__c = true;
update pipeline;

System.debug('Production env id=' + productionEnv.Id);
System.debug('Dev env id=' + devEnv.Id);
System.debug('Pipeline activated=' + pipeline.sf_devops__Activated__c);
