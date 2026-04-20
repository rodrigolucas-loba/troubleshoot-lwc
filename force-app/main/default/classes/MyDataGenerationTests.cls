@IsTest
private class MyDataGenerationTests {
  @TestSetup
  static void loadOtherAccounts() {
    Test.loadData(Account.SObjectType, 'otherAccountData');
  }

  @IsTest
  static void testLoadOtherAccountsFromStaticResource() {
    List<Account> accts = [SELECT Id FROM Account];
    Assert.areEqual(15, accts.size(), 'Expected 15 accounts');
  }
}
