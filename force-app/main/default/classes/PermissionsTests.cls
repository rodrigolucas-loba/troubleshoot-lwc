@IsTest
private class PermissionsTests {
  @TestSetup
  static void testSetup() {
    Account acct = new Account(Name = 'No view For You!');
    insert acct;

    Private_Object__c privateObj = new Private_Object__c(
      Account__c = acct.Id,
      Notes__c = 'foo'
    );
    insert privateObj;
  }

  @IsTest
  static void testNegativePermissionSet() {
    User userNew = new User(
      ProfileId = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1]
      .Id,
      LastName = 'NoAccess',
      Email = 'noaccess@example.com',
      UserName = 'noaccess.' + DateTime.now().getTime() + '@example.com',
      Alias = 'noacc',
      TimeZoneSidKey = 'America/Los_Angeles',
      EmailEncodingKey = 'UTF-8',
      LanguageLocaleKey = 'en_US',
      LocaleSidKey = 'en_US'
    );
    insert userNew;

    System.runAs(userNew) {
      Test.startTest();
      Private_Object__c[] privateObj = [
        SELECT Id, Account__c, Notes__c
        FROM Private_Object__c
      ];
      Test.stopTest();

      Assert.areEqual(
        0,
        privateObj.size(),
        'A user without the permission set shouldn\'t see any records'
      );
    }
  }

  @IsTest
  static void testPositivePermissionSet() {
    User userNew = new User(
      ProfileId = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1]
      .Id,
      LastName = 'HasAccess',
      Email = 'hasaccess@example.com',
      UserName = 'hasaccess.' + DateTime.now().getTime() + '@example.com',
      Alias = 'hasac',
      TimeZoneSidKey = 'America/Los_Angeles',
      EmailEncodingKey = 'UTF-8',
      LanguageLocaleKey = 'en_US',
      LocaleSidKey = 'en_US'
    );
    insert userNew;

    PermissionSet ps = [
      SELECT Id
      FROM PermissionSet
      WHERE Name = 'Private_Object_Access'
      LIMIT 1
    ];
    insert new PermissionSetAssignment(
      AssigneeId = userNew.Id,
      PermissionSetId = ps.Id
    );

    System.runAs(userNew) {
      Test.startTest();
      Private_Object__c[] privateObj = [
        SELECT Id, Account__c, Notes__c
        FROM Private_Object__c
      ];
      Test.stopTest();

      Assert.areEqual(
        1,
        privateObj.size(),
        'A user with the permission set should see the private object record'
      );
    }
  }
}
