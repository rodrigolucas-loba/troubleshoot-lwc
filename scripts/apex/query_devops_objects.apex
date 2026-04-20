// Query DevOps Center objects to understand the schema
System.debug('=== Querying DevOps Center Objects ===\n');

// Query Projects
try {
    List<sf_devops__Project__c> projects = [
        SELECT Id, Name, CreatedDate
        FROM sf_devops__Project__c
        ORDER BY CreatedDate DESC
        LIMIT 5
    ];
    System.debug('PROJECTS (' + projects.size() + ' found):');
    for (sf_devops__Project__c proj : projects) {
        System.debug('  - ' + proj.Name + ' (ID: ' + proj.Id + ')');
    }
} catch (Exception e) {
    System.debug('Error querying projects: ' + e.getMessage());
}

System.debug('\n');

// Query Pipelines
try {
    List<sf_devops__Pipeline__c> pipelines = [
        SELECT Id, Name, sf_devops__Project__r.Name
        FROM sf_devops__Pipeline__c
        ORDER BY CreatedDate DESC
        LIMIT 5
    ];
    System.debug('PIPELINES (' + pipelines.size() + ' found):');
    for (sf_devops__Pipeline__c pipe : pipelines) {
        System.debug('  - ' + pipe.Name + ' (Project: ' + pipe.sf_devops__Project__r.Name + ')');
    }
} catch (Exception e) {
    System.debug('Error querying pipelines: ' + e.getMessage());
}

System.debug('\n');

// Query Environments
try {
    List<sf_devops__Environment__c> environments = [
        SELECT Id, Name, 
               sf_devops__Named_Credential__c,
               sf_devops__Org_Id__c,
               sf_devops__Project__r.Name
        FROM sf_devops__Environment__c
        ORDER BY Name
    ];
    System.debug('ENVIRONMENTS (' + environments.size() + ' found):');
    for (sf_devops__Environment__c env : environments) {
        System.debug('  - ' + env.Name);
        System.debug('    Project: ' + env.sf_devops__Project__r.Name);
        System.debug('    Named Credential: ' + env.sf_devops__Named_Credential__c);
        System.debug('    Org ID: ' + env.sf_devops__Org_Id__c);
    }
} catch (Exception e) {
    System.debug('Error querying environments: ' + e.getMessage());
}