@IsTest
private class ExternalSearchTests {
  @IsTest
  static void testPositiveMocking() {
    Test.setMock(
      HttpCalloutMock.class,
      new HTTPMockFactory(200, 'OK', 'search results')
    );

    Test.startTest();
    String result = ExternalSearch.googleIt('trailhead');
    Test.stopTest();

    Assert.areEqual(
      'search results',
      result,
      'Expected response body to be returned.'
    );
  }

  @IsTest
  static void testNegativeMocking() {
    Test.setMock(
      HttpCalloutMock.class,
      new HTTPMockFactory(500, 'Server Error', 'failure')
    );

    Test.startTest();
    try {
      ExternalSearch.googleIt('trailhead');
      Assert.fail('Expected ExternalSearchException for non-200 response.');
    } catch (ExternalSearch.ExternalSearchException ex) {
      Assert.areEqual(
        'Did not receive a 200 status code: 500',
        ex.getMessage(),
        'Expected status code to be included in exception message.'
      );
    }
    Test.stopTest();
  }
}
