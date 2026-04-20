public with sharing class HouseService {
    @AuraEnabled(cacheable=true)
    public static List<House__c> getRecords() {
        try {
            // Versão sem WITH USER_MODE e sem LIMIT/ORDER para garantir a captura
            return [SELECT Id, Name, Address__c, State__c, City__c, Zip__c FROM House__c];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}