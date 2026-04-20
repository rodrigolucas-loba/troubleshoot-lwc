List<String> credentialNames = new List<String>{
    'Production_1PJd20000004WkTGAU_1776244895509',
    'Dev_1PJd20000004WkTGAU_1776244935056'
};

for (String credentialName : credentialNames) {
    HttpRequest req = new HttpRequest();
    req.setMethod('GET');
    req.setEndpoint(
        'callout:' + credentialName +
        '/services/data/v66.0/query?q=' +
        EncodingUtil.urlEncode('SELECT Id, InstanceName, OrganizationType FROM Organization', 'UTF-8')
    );
    HttpResponse res = new Http().send(req);
    System.debug(credentialName + ' status=' + res.getStatusCode());
    System.debug(credentialName + ' body=' + res.getBody());
}
