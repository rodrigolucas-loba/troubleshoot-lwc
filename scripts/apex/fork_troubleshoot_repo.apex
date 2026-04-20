HttpRequest req = new HttpRequest();
req.setMethod('POST');
req.setHeader('Accept', 'application/vnd.github+json');
req.setEndpoint('callout:sf_devops__DevOps_Center_GitHub/repos/developerforce/troubleshoot-lwc/forks');

HttpResponse res = new Http().send(req);
System.debug('STATUS=' + res.getStatusCode());
System.debug('BODY=' + res.getBody());
