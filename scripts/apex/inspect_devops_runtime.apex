List<String> objectNames = new List<String>{
    'UserDevopsPreference',
    'sf_devops__App_Config__mdt',
    'sf_devops__Version__mdt',
    'DevopsRequestInfo'
};

Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();

for (String objectName : objectNames) {
    System.debug('=== ' + objectName + ' ===');
    if (!globalDescribe.containsKey(objectName)) {
        System.debug('Object not found');
        continue;
    }

    Schema.DescribeSObjectResult describeResult = globalDescribe.get(objectName).getDescribe();
    Map<String, Schema.SObjectField> fields = describeResult.fields.getMap();
    List<String> fieldNames = new List<String>(fields.keySet());
    fieldNames.sort();
    System.debug('Queryable=' + describeResult.isQueryable() + ', Custom=' + describeResult.isCustom() + ', Fields=' + fieldNames);

    if (!describeResult.isQueryable()) {
        continue;
    }

    List<String> selectedFields = new List<String>();
    for (String fieldName : fieldNames) {
        Schema.DescribeFieldResult fieldDescribe = fields.get(fieldName).getDescribe();
        if (!fieldDescribe.isAccessible()) {
            continue;
        }
        if (fieldDescribe.getType() == Schema.DisplayType.Base64) {
            continue;
        }
        if (fieldDescribe.getType() == Schema.DisplayType.Address) {
            continue;
        }
        if (fieldDescribe.getType() == Schema.DisplayType.Location) {
            continue;
        }
        selectedFields.add(fieldName);
    }

    if (selectedFields.isEmpty()) {
        System.debug('No accessible fields');
        continue;
    }

    String soql = 'SELECT ' + String.join(selectedFields, ', ') + ' FROM ' + objectName + ' LIMIT 5';
    try {
        List<SObject> rows = Database.query(soql);
        System.debug('Row count=' + rows.size());
        for (SObject row : rows) {
            System.debug(JSON.serializePretty(row));
        }
    } catch (Exception ex) {
        System.debug('Query failed: ' + ex.getMessage());
    }
}
