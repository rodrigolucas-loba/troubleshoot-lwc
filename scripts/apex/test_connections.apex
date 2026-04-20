// Test Named Credential connections
System.debug('=== Testing DevOps Center Named Credential Connections ===\n');

List<String> credentialNames = new List<String>{
    'Dev_1PJd20000004WkTGAU_1776244935056',
    'Production_1PJd20000004WkTGAU_1776244895509'
};

for (String credentialName : credentialNames) {
    System.debug('Testing: ' + credentialName);
    try {
        HttpRequest req = new HttpRequest();
        req.setMethod('GET');
        req.setTimeout(10000);
        req.setEndpoint(
            'callout:' + credentialName +
            '/services/data/v66.0/query?q=' +
            EncodingUtil.urlEncode('SELECT Id, Name, InstanceName FROM Organization', 'UTF-8')
        );
        
        HttpResponse res = new Http().send(req);
        System.debug('  Status Code: ' + res.getStatusCode());
        
        if (res.getStatusCode() == 200) {
            Map<String, Object> responseData = (Map<String, Object>)JSON.deserializeUntyped(res.getBody());
            List<Object> records = (List<Object>)responseData.get('records');
            if (!records.isEmpty()) {
                Map<String, Object> org = (Map<String, Object>)records[0];
                System.debug('  ✓ SUCCESS - Connected to: ' + org.get('Name'));
                System.debug('  Instance: ' + org.get('InstanceName'));
            }
        } else {
            System.debug('  ❌ FAILED');
            System.debug('  Response: ' + res.getBody());
        }
    } catch (Exception e) {
        System.debug('  ❌ ERROR: ' + e.getMessage());
    }
    System.debug('');
}