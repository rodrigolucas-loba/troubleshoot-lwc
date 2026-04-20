@IsTest
global class HTTPMockFactory implements HttpCalloutMock {
  private Integer statusCode;
  private String status;
  private String body;

  global HTTPMockFactory(Integer code, String status, String body) {
    this.statusCode = code;
    this.status = status;
    this.body = body;
  }

  global HTTPResponse respond(HTTPRequest req) {
    HttpResponse res = new HttpResponse();
    res.setStatusCode(statusCode);
    res.setStatus(status);
    res.setBody(body);
    return res;
  }
}
