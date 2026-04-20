sf_devops__Project__c projectRecord = [
    SELECT Id, sf_devops__Package_Directories__c
    FROM sf_devops__Project__c
    WHERE Id = 'a0Md2000000luJhEAI'
    LIMIT 1
];

projectRecord.sf_devops__Package_Directories__c = '[{"path":"force-app","default":true}]';
update projectRecord;

System.debug(projectRecord.sf_devops__Package_Directories__c);
