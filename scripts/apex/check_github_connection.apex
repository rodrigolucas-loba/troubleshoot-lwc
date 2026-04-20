List<String> endpoints = new List<String>{
    '/user',
    '/repos/rodrigolucas-loba/troubleshoot-lwc',
    '/repos/rodrigolucas-loba/new_demo_2'
};

for (String path : endpoints) {
    HttpRequest req = new HttpRequest();
    req.setMethod('GET');
    req.setEndpoint('callout:sf_devops__DevOps_Center_GitHub' + path);

    HttpResponse res = new Http().send(req);
    System.debug('PATH=' + path);
    System.debug('STATUS=' + res.getStatusCode());
    System.debug('BODY=' + res.getBody());
}
