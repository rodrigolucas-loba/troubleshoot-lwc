@IsTest
public with sharing class Test_BadBunchController {
  @IsTest
  static void testGenerateJSONRecords() {
    Test.startTest();
    String records = BadBunchController.generateJSONRecords(2);
    Test.stopTest();

    System.assert(String.isNotEmpty(records), 'Returned an empty string');
  }
}
